export const config = {
  runtime: 'edge',
};

const SCALA_BACKEND_URL = 'https://diagnostico-scalabackendapi.onrender.com';

export default async function handler(request) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const targetUrl = SCALA_BACKEND_URL + '/api/chat';

  const headers = new Headers();
  headers.set('Content-Type', 'application/json');
  const incomingContentType = request.headers.get('Content-Type');
  if (incomingContentType) {
    headers.set('Content-Type', incomingContentType);
  }

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers,
      body: request.body,
    });

    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', response.headers.get('Content-Type') ?? 'application/json');

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        message: `Edge proxy error: ${err instanceof Error ? err.message : String(err)}`,
        data: null,
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
