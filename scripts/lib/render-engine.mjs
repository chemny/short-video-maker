export const selectRenderEngine = ({explicit, plan, env = process.env} = {}) => {
  const engine = explicit ?? plan?.meta?.renderEngine ?? env.SHORT_VIDEO_RENDER_ENGINE ?? 'remotion';
  if (!['remotion', 'hyperframes'].includes(engine)) throw new Error(`Unknown render engine: ${engine}; choose remotion or hyperframes`);
  return engine;
};
