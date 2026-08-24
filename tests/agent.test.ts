import assert from 'node:assert/strict';
import test, { afterEach } from 'node:test';

import { TOOLS, runAgent } from '../lib/agent';
import { supportsTools } from '../lib/ollamaServer';

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/**
 * Stand in for Ollama's /api/chat plus whatever the tools reach for. `turns`
 * is the sequence of assistant replies; each call consumes the next one.
 */
const mockOllama = (turns: any[]) => {
  const seen: { messages: any[]; tools: any }[] = [];
  let turn = 0;

  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = typeof input === 'string' ? input : input.url;

    if (url.includes('/api/chat')) {
      const body = JSON.parse(init.body as string);
      seen.push({ messages: body.messages, tools: body.tools });
      const message = turns[Math.min(turn, turns.length - 1)];
      turn += 1;
      return new Response(JSON.stringify({ message }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Anything else is a tool reaching out; answer as the search provider.
    return new Response(
      `<a class="result__a" href="https://example.com/a">A result</a>
       <a class="result__snippet">Steam Deck OLED is $549 new.</a>`,
      { status: 200, headers: { 'Content-Type': 'text/html' } }
    );
  }) as typeof fetch;

  return seen;
};

test('offers the model tools that describe when to use them', () => {
  const names = TOOLS.map((t) => t.function.name);
  assert.deepEqual(names, ['search_web', 'get_trending', 'scan_prices']);

  for (const tool of TOOLS) {
    // A bare name teaches the model nothing about when to reach for it.
    assert.ok(
      tool.function.description.length > 60,
      `${tool.function.name} needs a description that says when to use it`
    );
    assert.equal(tool.function.parameters.type, 'object');
  }

  const search = TOOLS.find((t) => t.function.name === 'search_web');
  assert.deepEqual(search?.function.parameters.required, ['query']);
  // Trending works with no topic, so nothing may be required.
  const trending = TOOLS.find((t) => t.function.name === 'get_trending');
  assert.equal(trending?.function.parameters.required, undefined);
});

test('reports that a model without tool support cannot drive itself', async () => {
  assert.equal(supportsTools('llama3.2'), true);
  assert.equal(supportsTools('qwen2.5:7b'), true);
  assert.equal(supportsTools('deepseek-r1:7b'), true);
  assert.equal(supportsTools('moondream'), false);
  assert.equal(supportsTools('tinyllama'), false);

  const result = await runAgent('hello', [], 'tinyllama');
  // The caller needs to know to fall back rather than get an empty reply.
  assert.deepEqual(result, { reply: '', runs: [], usedTools: false });
});

test('answers small talk directly, without calling anything', async () => {
  const seen = mockOllama([{ role: 'assistant', content: 'Hello — how can I help?' }]);

  const result = await runAgent('hi there', [], 'llama3.2');

  assert.equal(result.reply, 'Hello — how can I help?');
  assert.equal(result.runs.length, 0, 'should not have called a tool');
  assert.equal(result.usedTools, true);
  // The tool manifest is still offered; the model simply declined to use it.
  assert.equal(seen[0].tools.length, 3);
});

test('runs the tool the model asks for, then answers from its result', async () => {
  const seen = mockOllama([
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        { function: { name: 'scan_prices', arguments: { product: 'Steam Deck OLED' } } },
      ],
    },
    { role: 'assistant', content: 'A Steam Deck OLED is around $549 new.' },
  ]);

  const result = await runAgent('what does a steam deck cost', [], 'llama3.2');

  assert.equal(result.reply, 'A Steam Deck OLED is around $549 new.');
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].name, 'scan_prices');
  assert.deepEqual(result.runs[0].args, { product: 'Steam Deck OLED' });

  // The tool's output must be fed back before the model answers.
  const secondCall = seen[1].messages;
  const toolTurn = secondCall.find((m: any) => m.role === 'tool');
  assert.ok(toolTurn, 'the tool result should be appended to the conversation');
  assert.equal(toolTurn.tool_name, 'scan_prices');
});

test('a failing tool is reported to the model, not thrown', async () => {
  const seen = mockOllama([
    {
      role: 'assistant',
      content: '',
      // No product supplied — the tool cannot run.
      tool_calls: [{ function: { name: 'scan_prices', arguments: {} } }],
    },
    { role: 'assistant', content: "I couldn't work out which product you meant." },
  ]);

  const result = await runAgent('how much', [], 'llama3.2');

  assert.equal(result.runs.length, 1);
  assert.ok(result.runs[0].error, 'the failure should be recorded');
  // And handed back so the model can respond to it.
  const toolTurn = seen[1].messages.find((m: any) => m.role === 'tool');
  assert.match(toolTurn.content, /failed/i);
  assert.match(result.reply, /couldn't work out/);
});

test('an unknown tool name does not crash the turn', async () => {
  mockOllama([
    {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'launch_rocket', arguments: {} } }],
    },
    { role: 'assistant', content: 'I cannot do that.' },
  ]);

  const result = await runAgent('do something odd', [], 'llama3.2');
  assert.equal(result.runs[0].error, 'unknown tool');
  assert.equal(result.reply, 'I cannot do that.');
});

test('stops after three rounds instead of looping forever', async () => {
  // A model that only ever asks for another search.
  const seen = mockOllama([
    {
      role: 'assistant',
      content: '',
      tool_calls: [{ function: { name: 'search_web', arguments: { query: 'again' } } }],
    },
  ]);

  const result = await runAgent('loop please', [], 'llama3.2');

  // Three tool rounds, then one forced answer — never unbounded.
  assert.equal(result.runs.length, 3);
  assert.ok(seen.length <= 5, `expected a bounded number of calls, got ${seen.length}`);
  // The final request must offer no tools, so the model has to answer.
  assert.equal(seen[seen.length - 1].tools, undefined);
});

test('passes prior turns so follow-ups have context', async () => {
  const seen = mockOllama([{ role: 'assistant', content: 'It was £42.' }]);

  await runAgent(
    'and in pounds?',
    [
      { role: 'user', content: 'what does it cost' },
      { role: 'assistant', content: 'About $53.' },
    ],
    'llama3.2'
  );

  const sent = seen[0].messages;
  assert.equal(sent[0].role, 'system');
  assert.equal(sent[1].content, 'what does it cost');
  assert.equal(sent[2].role, 'assistant');
  assert.equal(sent[3].content, 'and in pounds?');
});
