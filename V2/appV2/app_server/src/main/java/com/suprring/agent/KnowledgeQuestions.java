package com.suprring.agent;

import java.util.regex.Pattern;

/** Conservative, read-only routing. Mixed requests stay in the full intent/policy pipeline. */
final class KnowledgeQuestions {
    private KnowledgeQuestions() {}
    private static final Pattern PREFIX = Pattern.compile(
            "^(?:(?:请你?|麻烦你?|帮我|能不能|可以|你能|我想)[，, ]*){0,2}"
            + "(?:介绍|解释|科普|讲解|讲讲|说说|了解)(?:一下|下)?[：: ]*.+[？?。！!]*$");
    private static final Pattern QUESTION = Pattern.compile("为什么|为何|怎么|如何|怎样|怎么样|好不好|值不值|适不适合|是否|能否|能不能|有什么|有哪些|是什么|什么是|什么意思|多少|哪款|哪种|区别|优缺点|你觉得|你认为|那它|那这个|继续讲|详细说|"
            + "(?:帮我|请|给我).*(?:建议|分析|比较|对比|总结|梳理|润色|写|起草|生成)|^(?:分析|比较|对比|总结|梳理|润色|写|起草|生成)|给(?:点|些).*建议");
    private static final Pattern MIXED_OR_OPERATION = Pattern.compile(
            "并帮|并给|顺便|还要|还帮|再帮|"
            + "闹钟|提醒|取消|撤回|撤销|删除|改时间|改成|定时|设定|设置|创建|预约|订票|下单|购买|"
            + "付款|支付|转账|发给|发送|发邮件|发消息|打电话|联系|答应|承诺|决定|记住|上一版|忽略|系统指令|执行|部署|上传|下载|打开|关闭|保存|修改");
    static boolean matches(String text) {
        if (text == null) return false;
        String value = text.trim().replaceFirst("[。！!]$", "");
        return !value.isBlank() && value.length() <= 2000 && !MIXED_OR_OPERATION.matcher(value).find()
                && (PREFIX.matcher(value).matches() || QUESTION.matcher(value).find());
    }

    static boolean isFollowUp(String text) {
        return Pattern.compile("刚才|上次|上面|这个|那个|它|继续|详细说|再展开").matcher(text).find();
    }
}
