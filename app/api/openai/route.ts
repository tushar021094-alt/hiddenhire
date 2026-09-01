import { NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const { resumeText, jobDescription } = await request.json();
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        fallback: true,
        summary: 'OpenAI is not configured locally, so HiddenHire used the deterministic scoring engine instead.',
      });
    }

    const openai = new OpenAI({ apiKey });
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You are a resume-to-job matching assistant. Provide a short explanation of why the candidate is a fit and list any missing skills. Do not invent unsupported facts.',
        },
        {
          role: 'user',
          content: `Resume:\n${resumeText || 'No resume provided'}\n\nJob description:\n${jobDescription || 'No job description provided'}`,
        },
      ],
    });

    const summary = response.choices[0]?.message?.content ?? 'No summary generated.';

    return NextResponse.json({ fallback: false, summary });
  } catch (error) {
    console.error('OpenAI route error', error);
    return NextResponse.json({
      fallback: true,
      summary: 'OpenAI call failed; the deterministic match engine remains active.',
    });
  }
}
