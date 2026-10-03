export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/server') {
    return nextResolve('next/server.js', context);
  }

  const candidate = specifier.startsWith('@/')
    ? new URL(`../${specifier.slice(2)}`, import.meta.url).href
    : specifier;

  try {
    return await nextResolve(candidate, context);
  } catch (error) {
    if (candidate.startsWith('.') && !candidate.endsWith('.ts')) {
      return nextResolve(`${candidate}.ts`, context);
    }

    if (candidate.startsWith('file:') && !candidate.endsWith('.ts')) {
      return nextResolve(`${candidate}.ts`, context);
    }

    throw error;
  }
}
