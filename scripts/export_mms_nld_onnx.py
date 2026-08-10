from pathlib import Path
import json
import shutil
import numpy as np
import onnx
import onnxruntime as ort
import soundfile as sf
import torch
from transformers import VitsModel, AutoTokenizer

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

# Save the original tokenizer/config assets needed by the browser wrapper.
tokenizer.save_pretrained(OUT)
model.config.save_pretrained(OUT)
if getattr(model, 'generation_config', None) is not None:
    model.generation_config.save_pretrained(OUT)

inputs = tokenizer(TEST_TEXT, return_tensors='pt')
input_ids = inputs['input_ids']
attention_mask = inputs.get('attention_mask', torch.ones_like(input_ids))

class BrowserVits(torch.nn.Module):
    def __init__(self, wrapped):
        super().__init__()
        self.wrapped = wrapped

    def forward(self, input_ids, attention_mask):
        result = self.wrapped(input_ids=input_ids, attention_mask=attention_mask)
        return result.waveform

wrapper = BrowserVits(model)
onnx_path = ONNX_DIR / 'model.onnx'
print('Exporting ONNX...')
with torch.no_grad():
    torch.onnx.export(
        wrapper,
        (input_ids, attention_mask),
        onnx_path,
        input_names=['input_ids', 'attention_mask'],
        output_names=['waveform'],
        dynamic_axes={
            'input_ids': {0: 'batch', 1: 'sequence'},
            'attention_mask': {0: 'batch', 1: 'sequence'},
            'waveform': {0: 'batch', 1: 'samples'},
        },
        opset_version=17,
        do_constant_folding=True,
    )

print('Checking ONNX structure...')
onnx_model = onnx.load(str(onnx_path))
onnx.checker.check_model(onnx_model)

print('Running ONNX Runtime validation...')
session = ort.InferenceSession(str(onnx_path), providers=['CPUExecutionProvider'])
ort_inputs = {
    'input_ids': input_ids.cpu().numpy().astype(np.int64),
    'attention_mask': attention_mask.cpu().numpy().astype(np.int64),
}
waveform = session.run(None, ort_inputs)[0]
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
    'onnx_inputs': [x.name for x in session.get_inputs()],
    'onnx_outputs': [x.name for x in session.get_outputs()],
}
(OUT / 'joshfm-model.json').write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding='utf-8')

print(json.dumps(metadata, ensure_ascii=False, indent=2))
print(f'SUCCESS: browser model written to {OUT}')
