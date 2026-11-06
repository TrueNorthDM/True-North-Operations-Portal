/**
 * The Claude prompts of Topic Studio, as the Artifact keeps them (the SEO team's
 * recipe): what each feature does, the data variables it is filled with, and its
 * default prompt. An Admin can edit a prompt (Topic Studio settings); this file is
 * what "Restore default" goes back to. Generated from the Artifact's prompt
 * definitions in phase 3 (6 November 2026); the only change is that the em dash
 * became a hyphen, as in every string this product renders.
 *
 * A prompt asks for JSON and names its shape; ai/features.ts reads the answer.
 * {{name}} is a data variable.
 */

export type PromptKey = 'refine' | 'group' | 'cleanq' | 'answer' | 'insights' | 'commodity' | 'interview' | 'place' | 'review'

/** [name, what it holds, true when the prompt must keep it]. */
export type PromptVar = readonly [string, string, boolean]

export interface PromptDef {
  title: string
  /** The tab the feature lives on. */
  tab: string
  does: string
  vars: readonly PromptVar[]
  template: string
}

export const PROMPT_ORDER: readonly PromptKey[] = ["refine", "group", "cleanq", "answer", "insights", "commodity", "interview", "place", "review"]

export const PROMPT_DEFS: Record<PromptKey, PromptDef> = {
  refine: {
    title: "Refine terms",
    tab: "Topic terms tab",
    does: "Reviews the candidate terms and the current list, trims generic or duplicate terms, adds missing ones and labels each term high, medium or low relevance.",
    vars: [["client", "The client’s name and description from Admin → Clients", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["secondary", "Secondary keyphrases from Setup (or “none”, including when that feature is off)", false], ["rich_questions", "Rich result questions from Setup (or “none”)", false], ["followup_questions", "LLM follow-up questions from Setup (or “none”)", false], ["avoid_terms", "Specific terms to avoid from Setup (or “none”)", false], ["ai_answers", "The pasted AI Overview, ChatGPT, Gemini and Perplexity answers", false], ["competitor_meta", "Each captured competitor’s title and meta description", false], ["bible_books", "Bible books competitors cite (faith-based clients only, otherwise empty)", false], ["candidate_terms", "The top 160 candidate terms with competitor and AI-answer counts", true], ["current_terms", "The current term list; hand-added terms are marked manual", true], ["list_size", "The “Terms to build” build rule", false], ["list_size_max", "The “Terms to build” rule plus five", false], ["extra_term_ideas", "Where else to look for missing terms (differs for faith-based clients)", false]],
    template: "You help an SEO specialist build a list of semantic topic terms for writers creating content for {{client}}. The list guides writers to cover the topic naturally and helpfully for readers. It is not for keyword stuffing.\n\nArticle topic: {{topic}}\nPrimary keyphrase: {{primary}}\nSecondary keyphrases: {{secondary}}\nRich result questions: {{rich_questions}}\nAI follow-up questions: {{followup_questions}}\nSpecific terms to avoid: {{avoid_terms}}\n\nAI answers (Google AI Overview and other AI assistants):\n{{ai_answers}}\n\nCompetitor titles and meta descriptions:\n{{competitor_meta}}\n\n{{bible_books}}\n\nCandidate terms from n-gram analysis of the top competitors (term | competitors using it | total uses | number of AI answers using it):\n{{candidate_terms}}\n\nCurrent list (terms marked manual were added by the SEO and must be kept):\n{{current_terms}}\n\nDo this:\n1. Pick about {{list_size}} terms (never more than {{list_size_max}}) that are the most helpful for a reader searching this topic and order them by importance. Give a little extra weight to terms that help answer the rich result questions and to the secondary keyphrases.\n2. Remove terms that are generic, off-topic, website or brand names, navigation text, or the same concept as another term. Prefer specific multi-word phrases over generic single words: keep a single word only when it names a core concept of the topic, and aim for no more than about a third single words. When two terms mean the same thing keep the clearer wording. Remove anything tied to the specific terms to avoid, such as a book, product or event with a similar name but a different intent.\n3. Add up to 8 missing terms that are clearly helpful: key points from the AI Overview, ideas in the meta descriptions, {{extra_term_ideas}}.\n4. Label each term high, medium or low relevance.\n\nReply with only JSON in this shape:\n{\"terms\":[{\"term\":\"guilt\",\"relevance\":\"high\",\"added\":false,\"why\":\"\"}],\"removed\":[{\"term\":\"click here\",\"reason\":\"navigation text\"}]}\nOnly give \"why\" for added terms (one short sentence).",
  },
  group: {
    title: "Group terms",
    tab: "Topic terms tab",
    does: "Sorts the term list into named semantic groups and finds variants (the same idea in different words).",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["term_list", "Every term in the list, in order of importance", true]],
    template: "You help an SEO team organize a list of topic terms for writers creating content for {{client}}.\n\nTopic: {{topic}}\nPrimary keyphrase: {{primary}}\n\nTerms, in order of importance:\n{{term_list}}\n\nDo this:\n1. Group the terms into 3 to 10 semantic groups of closely related ideas. Give each group a short, plain name of 2 to 5 words. Put every term in exactly one group, using the terms exactly as written. Use a group named \"Other terms\" only for terms that fit nowhere else.\n2. Find variants: terms that name the same thing in different words, spellings, plurals, abbreviations or name forms, such as \"Ellen White\", \"Ellen G. White\" and \"Ellen Gould White\", or \"meter reading\" and \"meter readings\". For each set, pick the clearest term as the main one. Related but different things, such as two different types of meter, are not variants.\n\nReply with only JSON: {\"groups\":[{\"name\":\"...\",\"terms\":[\"...\"]}],\"variants\":[{\"main\":\"...\",\"same\":[\"...\"]}]}",
  },
  cleanq: {
    title: "Clean up questions and find gaps",
    tab: "Questions tab",
    does: "Removes weak competitor questions and suggests questions readers have that competitors did not answer well.",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["rich_questions", "Rich result questions already targeted (or “none”)", false], ["followup_questions", "AI follow-up questions already listed (or “none”)", false], ["competitor_questions", "Numbered questions found in competitor content, with how many competitors ask each", true], ["heading_outlines", "Each competitor’s H1–H3 headings", false], ["gap_audience", "What kind of gap questions to favor (differs for faith-based clients)", false]],
    template: "You help an SEO specialist plan an article for {{client}} that genuinely helps readers.\n\nArticle topic: {{topic}}\nPrimary keyphrase: {{primary}}\nRich result questions already targeted: {{rich_questions}}\nAI follow-up questions already listed: {{followup_questions}}\n\nQuestions found in competitor content (index: question [competitors]):\n{{competitor_questions}}\n\nCompetitor heading outlines:\n{{heading_outlines}}\n\nDo this:\n1. List the indexes of questions to remove because they are rhetorical, off-topic, promotional, or duplicate another question.\n2. Suggest 5 to 8 questions readers likely have that competitors did not answer well, {{gap_audience}}. Do not repeat any rich result question.\n\nReply with only JSON: {\"remove\":[{\"i\":3,\"reason\":\"rhetorical\"}],\"gaps\":[{\"q\":\"...?\",\"why\":\"one short sentence\"}]}",
  },
  answer: {
    title: "Draft the answer near the top",
    tab: "Questions tab",
    does: "Drafts short notes on what the summary answer at the top of the article should include.",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["direct_questions", "The questions marked “Answer directly” (or “none listed”)", false], ["ai_answers", "The pasted AI answers", false], ["competitor_openings", "The opening section of each captured competitor page", false]],
    template: "You help an SEO team plan the short summary answer near the top of an article for {{client}}, before the article goes into depth.\n\nTopic: {{topic}}\nPrimary keyphrase: {{primary}}\nQuestions the article will answer directly: {{direct_questions}}\n\nAI answers:\n{{ai_answers}}\n\nOpening sections of competitor pages:\n{{competitor_openings}}\n\nWrite 3 to 6 short notes, one sentence each and under 20 words, saying what our summary answer should include: the direct answer, key facts, important distinctions or terms, and anything that would make it more helpful than the AI answers. Recommend what our answer should say. Don’t describe competitors or reuse their wording.\n\nReply with only JSON: {\"points\":[\"...\"]}",
  },
  insights: {
    title: "Summarize discussions",
    tab: "Discussions tab",
    does: "Summarizes captured social discussions into pain points, wording, questions, misconceptions and angles.",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["discussion_threads", "The text of each captured discussion thread", true]],
    template: "You help writers creating content for {{client}} understand what real people say about a topic so they can answer people’s actual needs with care.\n\nTopic: {{topic}}\nPrimary keyphrase: {{primary}}\n\nSocial discussion threads:\n{{discussion_threads}}\n\nSummarize what these discussions reveal. Paraphrase; don't quote usernames. Keep each item to one sentence.\n\nReply with only JSON: {\"painPoints\":[\"...\"],\"language\":[\"phrases people use to describe it\"],\"questions\":[\"questions people ask\"],\"misconceptions\":[\"...\"],\"angles\":[\"helpful angles the article could take\"]}",
  },
  commodity: {
    title: "Map originality",
    tab: "Originality tab",
    does: "Reads the competitor pages and AI answers and drafts the originality opportunities, angle and depth, and the commodity map.",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["original_definition", "What counts as original for this client, from Admin → Clients", false], ["ai_answers", "The pasted AI answers", false], ["competitor_content", "Condensed text and headings of each captured competitor page", true]],
    template: "You help an SEO team plan an article for {{client}} that stands out. Analyze the competitor pages and AI answers below, then return SHORT notes. The SEO will review, edit and curate them before writers see them.\n\nTopic: {{topic}}\nPrimary keyphrase: {{primary}}\nWhat counts as original for this client: {{original_definition}}\n\nAI answers (commodity by definition, because AI tools already say it):\n{{ai_answers}}\n\nCompetitor pages (label, then condensed content):\n{{competitor_content}}\n\nRules:\n- Keep every item to one short sentence, under 20 words.\n- Give only the strongest, most relevant ideas: 3 to 5 items per list.\n- For opportunities and angle, recommend what OUR page should do. Don’t describe what competitors do, and never suggest copying or imitating them.\n\nReturn:\n1. baseline: points the AI answers or about half the competitors already make. Readers expect them, so the article should cover them briefly. Include the sources, using the labels given.\n2. unique: distinctive points only one competitor makes, with its label.\n3. gaps: what nobody covers well.\n4. opportunities: originality opportunities for our page, such as missing context, a common misconception, an overlooked scenario or exception, or unique value we can add from our own experience, voice or context.\n5. angle: the angle and depth to take, such as who we’re writing for, the right level of detail, what to emphasize and what to keep brief.\n\nReply with only JSON: {\"baseline\":[{\"point\":\"...\",\"sources\":[\"AI Overview\",\"#1 example.com\"]}],\"unique\":[{\"point\":\"...\",\"source\":\"#3 example.com\"}],\"gaps\":[{\"point\":\"...\"}],\"opportunities\":[\"...\"],\"angle\":[\"...\"]}",
  },
  interview: {
    title: "Interview and story prompts",
    tab: "Originality tab",
    does: "Writes questions for a subject expert and prompts for gathering stories or customer use cases.",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["original_definition", "What counts as original for this client", false], ["context_notes", "The angle, the points competitors already make and the gaps, when the Originality tab has them (otherwise empty)", false], ["who_examples", "Examples of who to ask (differs for faith-based clients)", false], ["story_kind", "Stories and testimonies, or customer use cases (differs for faith-based clients)", false]],
    template: "You help a writer creating content for {{client}} gather original material for an article.\n\nTopic: {{topic}}\nPrimary keyphrase: {{primary}}\nWhat counts as original for this client: {{original_definition}}\n{{context_notes}}\nWrite:\n1. Who to ask: 2 to 4 kinds of people who could supply real experience for this topic{{who_examples}}.\n2. 6 to 8 questions for a subject expert that draw out lived experience, specific scenarios, step-by-step practice, mistakes people make, and where they disagree with common advice.\n3. 3 to 5 prompts for collecting {{story_kind}}.\n\nReply with only JSON: {\"who\":[\"...\"],\"sme\":[\"...\"],\"stories\":[\"...\"]}",
  },
  place: {
    title: "Suggest natural placements",
    tab: "Writer workshop",
    does: "Suggests where in the draft each missing term could fit naturally, or why to skip it.",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["draft_outline", "Each section of the draft with its first lines", true], ["missing_terms", "Topic terms the draft doesn’t use yet, with relevance and where competitors use them", true]],
    template: "You help a writer creating content for {{client}} improve a draft so it covers the topic helpfully. Never suggest keyword stuffing. Only suggest a term where it would genuinely help the reader.\n\nTopic: {{topic}}\nPrimary keyphrase: {{primary}}\n\nDraft outline with the start of each section:\n{{draft_outline}}\n\nTerms the draft doesn't use yet (term [relevance] - competitor headings where it usually appears):\n{{missing_terms}}\n\nFor each term, either name the draft heading where it fits most naturally and say in one short sentence how to bring it in (you may include a brief example phrase), or skip it with a reason if it would not help this draft.\n\nReply with only JSON: {\"placements\":[{\"term\":\"self-compassion\",\"heading\":\"exact draft heading or Introduction\",\"how\":\"...\"}],\"skip\":[{\"term\":\"...\",\"reason\":\"...\"}]}",
  },
  review: {
    title: "Content review",
    tab: "Writer workshop",
    does: "Reviews the whole draft against the four content standards and lists original elements and section verdicts.",
    vars: [["client", "The client’s name and description", false], ["topic", "The Monday task name", false], ["primary", "The primary keyphrase", false], ["content_standards", "The four content standards: E-E-A-T, Clarity, Helpfulness and Originality", false], ["original_definition", "What counts as original for this client", false], ["ai_answers", "The pasted AI answers", false], ["baseline_points", "The “everyone says this” points from the Originality tab (otherwise empty)", false], ["competitor_headings", "Each competitor’s H1–H3 headings", false], ["seo_recommendations", "The answer-near-the-top notes, originality opportunities and angle the SEO curated", false], ["draft", "The writer’s draft with headings marked [H1], [H2] and so on", true]],
    template: "You are a senior content editor reviewing a draft for {{client}}. Review it honestly against the team’s four content standards. Be specific, quote short excerpts (under 20 words) as evidence, and name the section for every fix.\n\nThe standards:\n{{content_standards}}\n\nWhat counts as original for this client: {{original_definition}}\n\nTopic question: {{topic}}\nPrimary keyphrase: {{primary}}\n\nAI answers (commodity by definition):\n{{ai_answers}}\n{{baseline_points}}\nCompetitor headings:\n{{competitor_headings}}\n\nThe SEO’s recommendations for this article:\n{{seo_recommendations}}\n\nThe draft:\n{{draft}}\n\nDo this:\n1. For each standard, give a rating (strong, ok or needs work), a two-sentence summary and up to 4 concrete fixes.\n2. Opening: does the article give a solid summary answer to the topic question within its first few sentences? Closing: does it end with clear takeaways or a conclusion?\n3. List every original element in the draft and its type (story, testimony, quote, advice, recommendation, use case, voice, regional context, data, other). Original means drawn from real experience, a subject expert, or the client’s distinctive voice or context. Depth, length, thoroughness and formatting alone are not original, and common knowledge found in competitors or the AI Overview is not original.\n4. For each H2 section, say whether it is original, mixed or commodity, with a short note.\n5. If gathered material is missing from the draft, mention it in the Originality fixes.\n\nReply with only JSON: {\"criteria\":[{\"name\":\"E-E-A-T\",\"rating\":\"ok\",\"summary\":\"...\",\"fixes\":[\"...\"]},{\"name\":\"Clarity\",\"rating\":\"strong\",\"summary\":\"...\",\"fixes\":[]},{\"name\":\"Helpfulness\",\"rating\":\"needs work\",\"summary\":\"...\",\"fixes\":[]},{\"name\":\"Originality\",\"rating\":\"needs work\",\"summary\":\"...\",\"fixes\":[]}],\"opening\":{\"ok\":true,\"note\":\"...\"},\"closing\":{\"ok\":false,\"note\":\"...\"},\"original\":[{\"type\":\"story\",\"excerpt\":\"...\",\"heading\":\"...\"}],\"sections\":[{\"heading\":\"...\",\"verdict\":\"commodity\",\"note\":\"...\"}]}",
  },
}
