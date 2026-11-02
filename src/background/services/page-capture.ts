/** 页面捕获共用的内容脚本准备与超时处理。 */

export async function withCaptureTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('网页捕获超时')), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** 安装前已打开的标签页可能没有内容脚本，两项捕获都在准备完成后开始。 */
export async function prepareCaptureTab(tabId: number): Promise<number> {
  const ping = () => withCaptureTimeout(
    chrome.tabs.sendMessage(tabId, { type: 'PING' }, { frameId: 0 }),
    3000,
  );
  try {
    const response = await ping();
    if (response?.success) return tabId;
  } catch {
    // 消息通道不存在时注入内容脚本，然后重新确认主框架可响应。
  }
  const files = chrome.runtime.getManifest().content_scripts?.[0]?.js;
  if (!files?.length) throw new Error('网页捕获脚本不可用');
  await chrome.scripting.executeScript({ target: { tabId, frameIds: [0] }, files });
  const response = await ping();
  if (!response?.success) throw new Error('网页捕获脚本未就绪');
  return tabId;
}
