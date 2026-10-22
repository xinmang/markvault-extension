/**
 * AI 提示词模板常量
 */

import type { AIRequest } from '@/types';

/**
 * 构建 AI 提示词
 */
export function buildDefaultPrompt(request: AIRequest): string {
  const { page, context, options } = request;

  return `
你是一个智能书签标签推荐助手。请根据网页内容和用户的已有标签库,推荐最相关的标签。

网页信息:
- 标题: ${page.title}
- URL: ${page.url}
- 描述: ${page.description || '无'}
- 内容摘要: ${page.content?.substring(0, 500) || '无'}

已有标签库 (${context.existingTags.length} 个):
${context.existingTags.slice(0, 100).join(', ')}

最近书签参考:
${context.recentBookmarks.slice(0, 10).map(b =>
  `- ${b.title} [${b.tags.join(', ')}]`
).join('\n')}

要求:
1. 推荐 ${options.maxTags} 个最相关的标签
2. ${options.preferExisting ? '优先' : '可以'}使用已有标签
3. **层级化标签策略**：
   - 至少包含 1-2 个通用大分类标签（如：邮箱、GitHub）
   - 再包含具体的细分标签（如：Gmail、谷歌邮箱、企业邮箱）
   - 示例：Gmail → 推荐 ["邮箱", "Gmail", "谷歌服务"]
   - 示例：GitHub 仓库链接 → 推荐 ["GitHub", "开源", "代码托管"]
4. 标签应该简洁(1-3个字)、准确、通用性强
5. **语言要求（最高优先级，必须严格执行）**：
   - translatedTitle 与 translatedDescription **必须使用简体中文**
   - 只要原文是英文或其他外文，就必须翻译成中文；**严禁把英文原文直接放进 translatedDescription**
   - 若原文本身就是中文，则原样返回
   - 即使用户只关心标签，也必须完成上述翻译字段，不允许留空或返回 null
   - 标题和描述只能依据当前 URL 对应的网页信息；最近书签、标签库和示例不能作为描述的事实来源
   - 缺少描述时，概括当前网页的内容摘要；连正文也缺失时只翻译当前标题，不推测网站功能
6. **极其重要 - 必须严格执行**: 标注每个标签是否为新标签
   - 仔细检查推荐的标签名是否**完全匹配**上面"已有标签库"中的任意一个标签
   - 如果标签名在已有标签库中找到了**完全相同**的匹配，设置 isNew: false
   - 如果标签名在已有标签库中**找不到完全相同**的匹配，设置 isNew: true
   - 必须逐个检查，不要猜测
7. **输出格式必须严格为单个 JSON 对象**，结构如下：
   {"suggestedTags": [{"name": "标签名", "isNew": false, "confidence": 0.9}], "translatedTitle": "翻译成简体中文的标题", "translatedDescription": "翻译成简体中文的描述"}
   - translatedTitle / translatedDescription 的值必须是中文字符串，禁止英文
   - 不得包含多余文本、解释、换行提示或 Markdown
   - 不得输出思考过程、reasoning_content、警告或其它键
   - 如确实无法翻译，返回 {"suggestedTags": [], "translatedTitle": null, "translatedDescription": null}
8. 只返回JSON，不要任何其他内容
  `.trim();
}

/**
 * 自定义提示词模板（用于设置页面的示例）
 */
export const DEFAULT_PROMPT_TEMPLATE = `你是一个专业的书签管理助手。请根据网页信息为用户推荐最合适的标签。

网页信息：
- 标题：{title}
- 网址：{url}
- 描述：{description}
- 内容摘要：{content}

用户已有的标签库：
{existingTags}

最近收藏的书签参考：
{recentBookmarks}

任务：
请分析网页内容，并推荐 {maxTags} 个最相关的标签。

推荐规则：
1. 优先匹配已有的标签库，避免生成重复或近义标签
2. **层级化标签策略**：
   - 至少包含 1-2 个通用大分类标签（如：邮箱、GitHub）
   - 再包含具体的细分标签（如：Gmail、谷歌邮箱、企业邮箱）
   - 示例：Gmail → 推荐 ["邮箱", "Gmail", "谷歌服务"]
   - 示例：GitHub 仓库链接 → 推荐 ["GitHub", "开源", "代码托管"]
3. 标签要简洁明了，一般为 2-4 个汉字
4. 覆盖网页的核心主题、内容类型与关键信息
5. 结合用户的收藏目的和使用场景，避免过于冷僻的标签
6. 确保标签具有通用性和可检索性，便于分类与查找
7. **语言要求（最高优先级，必须严格执行）**：无论网页原文是何种语言，translatedTitle 与 translatedDescription 都必须使用**简体中文**；原文为英文或其他外文时必须翻译，**绝不能原样返回英文**；原文已是中文时原样返回
   - 标题和描述只能依据当前 URL 对应的网页信息，不得借用最近书签、标签库或示例中的事实
   - 描述缺失时概括当前网页正文；正文也缺失时只翻译当前标题，不推测网站功能
8. 每个推荐标签需要包含：name（标签名）、isNew（是否为新标签）、confidence（相关性置信度 0-1）
9. **极其重要 - 必须严格执行**：标注每个标签是否为新标签
   * 仔细检查推荐的标签名是否**完全匹配**上面"已有标签库"中的任意一个标签
   * 如果标签名在已有标签库中找到了**完全相同**的匹配，设置 isNew: false
   * 如果标签名在已有标签库中**找不到完全相同**的匹配，设置 isNew: true
   * 必须逐个检查，不要猜测
10. 每个标签还需标注相关性置信度 confidence（范围 0-1）

返回格式（严格遵循）：
{"suggestedTags": [{"name": "标签名", "isNew": false, "confidence": 0.9}], "translatedTitle": "翻译成简体中文的标题", "translatedDescription": "翻译成简体中文的描述"}

JSON 输出要求：
* 必须输出且仅输出一个合法 JSON 对象，不允许附加任何解释、reasoning 内容或额外键
* 禁止输出 Markdown、换行提示、警告或其他文本
* translatedTitle / translatedDescription 的值必须是中文字符串，禁止英文
* 如无法生成有效结果，请返回 {"suggestedTags": [], "translatedTitle": null, "translatedDescription": null}
* 标签语言不限，在没有合适标签时，可推荐更为合适的新标签`;

/**
 * ============================================================================
 * TypeSafe (jev) 专用提示词
 * ============================================================================
 *
 * jev 是 System One 结构化评估模型，**只做分拣 / 判定**，不具备自由文本生成能力：
 *   - 不翻译：不产出中文标题 / 描述；
 *   - 不造词：新标签只能从我们给出的候选集合中挑选；
 *   - 不接受自由文本 prompt，判定逻辑只能写在 questions.instructions 中。
 *
 * 因此这里**不包含任何翻译要求**；标题与描述直接沿用页面抓取到的原文
 * （见 TYPESAFE_DESCRIPTION_POLICY）。
 */

/**
 * jev 的判定口径：从用户已有标签库里做纯分拣，禁止翻译、禁止造新词。
 *
 * 重要：**不能把“标签太宽泛”当成否定理由**。用户标签库里大量是“工具”“AI”“开发”
 * 这类通用大分类，若以“不够具体”为由判否，整个库都会被否掉，结果就是 0 个标签。
 *
 * 说明：官方文档指出英文是主要训练语言、CJK 准确率相对较低，
 * 因此引导语使用英文撰写，标签名本身保持原样传入。
 */
export const TYPESAFE_SELECTION_GUIDE =
  'You are a bookmark tagging classifier. This is a pure selection task: ' +
  'the candidate tag below comes from the user\u2019s existing tag library, ' +
  'and you decide whether that tag is a good fit for the page described by `page`. ' +
  'A broad category tag is a good fit whenever the page clearly belongs to that category — ' +
  'never reject a tag merely because it is general or high-level. ' +
  'Do NOT translate, rewrite, summarise or generate any text, ' +
  'and never invent a new tag. ' +
  'Judge only from `page.title`, `page.url`, `page.description` and `page.content_excerpt`.';

/**
 * TypeSafe 的标签判定问题（对应 noul 类型）。
 *
 * @param tagName 候选标签名，来自用户标签库，保持原始语言（中文标签就传中文）
 */
export function buildTypeSafeTagQuestion(tagName: string): string {
  return (
    `${TYPESAFE_SELECTION_GUIDE} ` +
    `Candidate tag: "${tagName}". ` +
    `Answer yes when "${tagName}" is a relevant, useful tag for this page ` +
    `(including broad category tags the page belongs to). ` +
    `Answer no only when the tag is clearly unrelated or misleading for this page.`
  );
}

/**
 * TypeSafe 下的描述策略：**不要求翻译，直接使用抓取到的描述原文**。
 *
 * 该常量用于向 UI / 调用方显式声明这一能力边界，避免误以为 jev 会输出中文描述。
 */
export const TYPESAFE_DESCRIPTION_POLICY = 'reuse-source-description' as const;

/**
 * jev 的文件夹归类判定口径：同样是纯分类任务，禁止翻译与生成。
 */
export const TYPESAFE_FOLDER_SELECTION_GUIDE =
  'You are a bookmark folder classifier. This is a pure classification task: ' +
  'decide whether the page described by `page` should be saved into one candidate folder. ' +
  'Do NOT translate, rewrite, summarise or generate any new text. ' +
  'Use `page.title`, `page.url` and `page.description` as evidence.';

/**
 * TypeSafe 的文件夹判定问题（对应 noul 类型）。
 *
 * @param folderPath 候选文件夹路径，必须与用户已有路径完全一致
 */
export function buildTypeSafeFolderQuestion(folderPath: string): string {
  return (
    `${TYPESAFE_FOLDER_SELECTION_GUIDE} ` +
    `Candidate folder path: "${folderPath}". ` +
    `Answer yes only when this page clearly belongs in "${folderPath}"; ` +
    `answer no when it belongs elsewhere or only loosely relates.`
  );
}
