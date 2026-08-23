interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  temperature?: number;
  top_k?: number;
  top_p?: number;
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
}

const OLLAMA_BASE_URL = process.env.NEXT_PUBLIC_OLLAMA_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.NEXT_PUBLIC_OLLAMA_MODEL || 'neural-chat';

export const generateResponse = async (
  prompt: string,
  model: string = DEFAULT_MODEL
): Promise<string> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        temperature: 0.7,
        top_k: 40,
        top_p: 0.9,
      } as OllamaGenerateRequest),
    });

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    return data.response.trim();
  } catch (error) {
    console.error('Error calling Ollama:', error);
    throw error;
  }
};

export const listAvailableModels = async (): Promise<string[]> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);

    if (!response.ok) {
      throw new Error(
        `Ollama API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.models?.map((m: any) => m.name) || [];
  } catch (error) {
    console.error('Error fetching Ollama models:', error);
    return [];
  }
};

export const checkOllamaStatus = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
    });
    return response.ok;
  } catch (error) {
    console.error('Ollama not available:', error);
    return false;
  }
};
