from pathlib import Path
import json
import numpy as np
import onnx
import onnxruntime as ort
import soundfile as sf
import torch
from transformers import VitsModel, AutoTokenizer
from optimum.exporters.onnx import main_export

MODEL_ID = 'facebook/mms-tts-nld'
OUT = Path('dist/mms-tts-nld-onnx')
ONNX_DIR = OUT / 'onnx'
TEST_TEXT = 'Welkom bij Josh FM. Dit is een test van de lokale Nederlandse radiostem.'

OUT.mkdir(parents=True, exist_ok=True)
ONNX_DIR.mkdir(parents=True, exist_ok=True)

print('Downloading Dutch MMS model...')
tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
model = VitsModel.from_pretrained(MODEL_ID)
model.eval()

# Save tokenizer/config assets needed by the browser wrapper.
tokenizer.save_pretrained(OUT)
model.config.save_pretrained(OUT)
if getattr(model, 'generation_config', None) is not None:
    model.generation_config.save_pretrained(OUT)

inputs = tokenizer(TEST_TEXT, return_tensors='pt')
input_ids = inputs['input_ids']
attention_mask = inputs.get('attention_mask', torch.ones_like(input_ids))

# VITS is stochastic: Optimum's reference-vs-ONNX validation can produce
# different waveform/spectrogram lengths even for a valid export. Disable
# that comparison and validate the exported graph ourselves with ORT below.
print('Exporting ONNX via Optimum (opset 18, custom ORT validation)...')
main_export(
    model_name_or_path=MODEL_ID,
    output=str(ONNX_DIR),
    task='text-to-speech',
    opset=18,
    do_validation=False,
)

onnx_path = ONNX_DIR / 'model.onnx'
if not onnx_path.exists():
    candidates = sorted(ONNX_DIR.glob('*.onnx'))
    if len(candidates) == 1:
        onnx_path = candidates[0]
    else:
        raise FileNotFoundError(
            f'Expected model.onnx, found: {[p.name for p in candidates]}'
        )

print(f'Checking ONNX structure: {onnx_path}')
onnx_model = onnx.load(str(onnx_path))
onnx.checker.check_model(onnx_model)

print('Running ONNX Runtime validation...')
session = ort.InferenceSession(str(onnx_path), providers=['CPUExecutionProvider'])
session_input_names = {x.name for x in session.get_inputs()}
ort_inputs = {}
if 'input_ids' in session_input_names:
    ort_inputs['input_ids'] = input_ids.cpu().numpy().astype(np.int64)
if 'attention_mask' in session_input_names:
    ort_inputs['attention_mask'] = attention_mask.cpu().numpy().astype(np.int64)

missing_inputs = session_input_names.difference(ort_inputs)
if missing_inputs:
    raise RuntimeError(
        f'Exported model requires unsupported extra inputs: {sorted(missing_inputs)}'
    )

outputs = session.run(None, ort_inputs)
output_names = [x.name for x in session.get_outputs()]

# Prefer the output explicitly named waveform; otherwise use the first output.
if 'waveform' in output_names:
    waveform = outputs[output_names.index('waveform')]
else:
    waveform = outputs[0]

waveform = np.asarray(waveform).squeeze().astype(np.float32)

if waveform.size < 8000:
    raise RuntimeError(f'Generated audio is unexpectedly short: {waveform.size} samples')
if not np.isfinite(waveform).all():
    raise RuntimeError('Generated audio contains NaN/Inf values')
peak = float(np.max(np.abs(waveform)))
if peak < 1e-5:
    raise RuntimeError('Generated audio is effectively silent')

sampling_rate = int(model.config.sampling_rate)
sf.write(OUT / 'validation.wav', waveform, sampling_rate)

metadata = {
    'source_model': MODEL_ID,
    'sampling_rate': sampling_rate,
    'test_text': TEST_TEXT,
    'samples': int(waveform.size),
    'seconds': round(float(waveform.size / sampling_rate), 3),
    'peak': peak,
    'onnx_file': str(onnx_path.relative_to(OUT)),
    'onnx_inputs': [x.name for x in session.get_inputs()],
    'onnx_outputs': output_names,
}
(OUT / 'joshfm-model.json').write_text(
    json.dumps(metadata, ensure_ascii=False, indent=2),
    encoding='utf-8',
)

print(json.dumps(metadata, ensure_ascii=False, indent=2))
print(f'SUCCESS: browser model written to {OUT}')