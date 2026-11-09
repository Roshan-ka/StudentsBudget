// The AI function's contract, as the app imports it (docs/superpowers/plans/2026-11-09-ai-phase-1.md). It lives with
// the Edge Function, which can't import from src/, so both sides read the one file.
export * from '../../../supabase/functions/_shared/ai/contract';
