export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ error: 'OpenAI API is not configured' });

  const prompt = String(req.body?.prompt || '').trim().slice(0, 4000);
  if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

  const context = req.body?.context || {};
  const instructions = `Je bent het AI-brein achter Josh FM, een persoonlijke Nederlandse radioshow.\n\nJe helpt alleen met radio-gerelateerde beslissingen en tekst, zoals:\n- muziekblokken en overgangen\n- korte Nederlandse presentatietekst\n- verzoeknummers interpreteren\n- radiomodus aanpassen\n- op basis van aangeleverde metadata een keuze uitleggen\n\nVerzin geen muziekfeiten. Gebruik feitelijke claims alleen wanneer ze in de context zijn aangeleverd. Houd antwoorden compact en bruikbaar voor de app.`;

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
        instructions,
        input: `CONTEXT:\n${JSON.stringify(context).slice(0, 12000)}\n\nOPDRACHT:\n${prompt}`,
        max_output_tokens: 400,
        store: false
      })
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(502).json({ error: 'OpenAI request failed', detail: err.slice(0, 500) });
    }

    const data = await response.json();
    const text = (data.output_text || extractText(data)).trim();
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: 'Assistant generation failed' });
  }
}

function extractText(data) {
  try {
    return (data.output || [])
      .flatMap(item => item.content || [])
      .filter(item => item.type === 'output_text')
      .map(item => item.text || '')
      .join(' ');
  } catch {
    return '';
  }
}
