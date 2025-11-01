import { NextResponse } from 'next/server';

export function corsHeaders(origin?: string): Record<string, string> {
  const allowedOrigin = origin || '*';
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

export function jsonCors(data: any, status: number = 200, origin?: string) {
  return NextResponse.json(data, {
    status,
    headers: corsHeaders(origin),
  });
}