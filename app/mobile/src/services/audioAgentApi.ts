const AUDIO_AGENT_BASE_URL = 'http://8.217.122.71:18987';

export type AudioAgentResult = {
  id: string;
  transcript: string;
  agent: {
    output: string;
    exitCode: number;
  };
};

export type AudioTaskType = 'recording_summary' | 'agent_command';

export async function processAudioWithAi(input: {
  uri: string;
  name: string;
  taskType?: AudioTaskType;
}): Promise<AudioAgentResult> {
  const body = new FormData();
  body.append('audio', {
    uri: input.uri,
    name: input.name || 'recording.ogg',
    type: 'audio/ogg'
  } as unknown as Blob);
  body.append('taskType', input.taskType ?? 'agent_command');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(`${AUDIO_AGENT_BASE_URL}/api/audio-task`, {
      method: 'POST',
      body,
      signal: controller.signal
    });
    const text = await response.text();
    let payload: unknown;

    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`Cloud returned invalid JSON (${response.status})`);
    }

    if (!response.ok) {
      throw new Error(readErrorMessage(payload) || `Cloud request failed (${response.status})`);
    }

    if (!isAudioAgentResult(payload)) {
      throw new Error('Cloud response is missing transcript or AI result');
    }

    return payload;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Cloud processing timed out after 5 minutes');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isAudioAgentResult(value: unknown): value is AudioAgentResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<AudioAgentResult>;
  return (
    typeof result.id === 'string' &&
    typeof result.transcript === 'string' &&
    !!result.agent &&
    typeof result.agent.output === 'string' &&
    typeof result.agent.exitCode === 'number'
  );
}

function readErrorMessage(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const error = (value as { error?: unknown }).error;
  return typeof error === 'string' ? error : null;
}
