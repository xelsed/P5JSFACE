class AIProcessor {
  async processSlices(slices, promptTemplate, apiKey, tableSize, onProgress) {
    if (!apiKey) {
      throw new Error('Missing API key');
    }
    const processed = [];
    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      const prompt = `${promptTemplate}\nInput polyline: ${JSON.stringify(slice)}\nOutput length: ${tableSize}`;
      const body = {
        model: 'o1-mini',
        input: prompt,
        temperature: 0.2
      };
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'OpenAI request failed');
      }
      const json = await response.json();
      const content = json?.output?.[0]?.content?.[0]?.text;
      let wavetable;
      try {
        wavetable = JSON.parse(content);
      } catch (err) {
        console.warn('Failed to parse AI response, falling back to zeros');
        wavetable = new Array(tableSize).fill(0);
      }
      processed.push(wavetable);
      onProgress?.({ completed: i + 1, total: slices.length });
    }
    return processed;
  }
}
