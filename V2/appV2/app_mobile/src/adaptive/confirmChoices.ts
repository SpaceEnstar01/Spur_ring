export type ConfirmGroup = {
  id: string;
  prompt: string;
  options: string[];
  multiple: boolean;
};

const platforms = ['抖音', '小红书', 'B站', 'YouTube'];

function clean(value: string) {
  return value.replace(/[*#_`]/g, '').trim();
}

function splitListed(prompt: string) {
  const marked = prompt.match(/选项[:：]\s*([^。？?]*)/);
  const example = prompt.match(/(?:比如|例如|如)[:：]?\s*([^。？?]{2,80})/);
  const source = marked?.[1] || example?.[1];
  if (!source) return [];
  const parts = source
    .split(/[、,，/]|或/)
    .map(part => part.replace(/[？?。]/g, '').trim())
    .filter(part => part.length > 0 && part.length <= 20);
  return parts.length >= 2 && parts.length <= 8 ? parts : [];
}

function optionsFor(prompt: string) {
  const listed = splitListed(prompt);
  if (listed.length >= 2) {
    return {
      options: listed,
      multiple: /哪些|多选|平台/.test(prompt) || listed.length > 3,
    };
  }
  if (/平台|抖音|小红书|哔哩|B站|YouTube|发布/.test(prompt)) {
    return { options: platforms, multiple: true };
  }
  if (/是否|要不要|需不需要/.test(prompt)) {
    return { options: ['是', '否'], multiple: false };
  }
  if (/用途/.test(prompt)) {
    return { options: ['个人参考', '商业分析'], multiple: false };
  }
  if (/地区|国内|海外/.test(prompt)) {
    return { options: ['国内', '海外', '不限'], multiple: false };
  }
  if (/语言|中文|英文/.test(prompt)) {
    return { options: ['中文', '英文'], multiple: false };
  }
  if (/品牌/.test(prompt)) {
    return { options: ['不限品牌', '我再指定'], multiple: false };
  }
  return { options: ['按原文继续', '我再补充'], multiple: false };
}

export function confirmGroups(reply = '', questions: string[] = []) {
  const prompts: string[] = [];
  questions.forEach(question => {
    const text = clean(question);
    if (text) prompts.push(text);
  });
  let inConfirm = false;
  reply.split('\n').forEach(line => {
    const plain = line.replace(/[*#_`>\-\s]/g, '');
    if (/^待确认/.test(plain)) {
      inConfirm = true;
      return;
    }
    if (/^#{1,3}/.test(line.trim()) && inConfirm && !/待确认/.test(plain)) {
      inConfirm = false;
    }
    const text = clean(line.replace(/^[\s>*\-•]+/, ''));
    if (!text) return;
    if (
      inConfirm ||
      /选项[:：]/.test(text) ||
      /哪个平台|哪些平台|发布平台|需要确认|请确认|是否/.test(text)
    ) {
      prompts.push(text);
    }
  });
  const seen = new Set<string>();
  const groups: ConfirmGroup[] = [];
  prompts.forEach((prompt, index) => {
    const key = prompt.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    groups.push({ id: `${index}-${key.slice(0, 16)}`, prompt, ...optionsFor(prompt) });
  });
  return groups;
}
