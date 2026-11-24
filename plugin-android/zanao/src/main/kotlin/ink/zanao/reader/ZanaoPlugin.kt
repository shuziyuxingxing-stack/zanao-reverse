package ink.zanao.reader

import io.github.whywood.deepdeep.plugin.api.Contributions
import io.github.whywood.deepdeep.plugin.api.DeepDeepPlugin
import io.github.whywood.deepdeep.plugin.api.PluginAvailability
import io.github.whywood.deepdeep.plugin.api.PluginHost
import io.github.whywood.deepdeep.plugin.api.PluginSkill
import io.github.whywood.deepdeep.plugin.api.PluginSkillFile
import io.github.whywood.deepdeep.plugin.api.PluginTool
import io.github.whywood.deepdeep.plugin.api.PluginToolResult
import io.github.whywood.deepdeep.plugin.api.post
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject

/**
 * 校园集市（com.comingx.zanao）只读插件。
 *
 * 走网页网关 https://c.zanao.com/sc-api：只认 Cookie 会话 + `X-Sc-Client: h5`，不需要签名。
 * 会话（Cookie）由用户通过 `zanao_set_cookie` 一次性导入，存到 host.secrets()。
 */
class ZanaoPlugin : DeepDeepPlugin {

    override suspend fun availability(host: PluginHost): PluginAvailability = PluginAvailability.Available

    override fun skills(host: PluginHost): List<PluginSkill> = listOf(
        PluginSkill(
            id = SKILL_ID,
            markdown = skillMarkdown(host),
            files = emptyList(),
        ),
    )

    override fun contributions(host: PluginHost): Contributions = Contributions(
        tools = listOf(
            setCookieTool(host),
            statusTool(host),
            threadListTool(host),
            searchTool(host),
            harvestTool(host),
            threadInfoTool(host),
        ),
    )

    // ---------------- tools ----------------

    private fun setCookieTool(host: PluginHost) = PluginTool(
        name = "zanao_set_cookie",
        label = "zanao_set_cookie",
        description = "导入集市网页会话：把 c.zanao.com 的 Cookie 字符串（k=v; k2=v2）存起来并校验。没有账号密码、或不想输密码时用。",
        parameters = buildJsonObject {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("cookie") {
                    put("type", "string")
                    put("description", "k=v; k2=v2 形式的 Cookie 头")
                }
            }
            putJsonArray("required") { add(JsonPrimitive("cookie")) }
        },
        promptGuidelines = listOf("用户没有集市密码时，先用 zanao_set_cookie 导入会话，再调用其它工具。"),
    ) { call ->
        val cookie = call.args["cookie"]?.jsonPrimitive?.content.orEmpty()
        host.secrets().put(COOKIE_KEY, cookie.trim())
        val st = status(host)
        if (st["errno"] == 0) {
            val payload = buildJsonObject {
                put("cookie", cookie.trim())
                put("source", "ink.zanao.reader")
            }
            host.bus().publish(io.github.whywood.deepdeep.plugin.api.PluginBusEvent("zanao.session.cookie", "ink.zanao.reader", payload, System.currentTimeMillis()))
        }
        PluginToolResult.text(jsonString(mapOf("ok" to true, "session" to st)))
    }

    private fun statusTool(host: PluginHost) = PluginTool(
        name = "zanao_status",
        label = "zanao_status",
        description = "检查集市会话是否有效（errno 20 表示需要登录/导入 Cookie）。",
        parameters = buildJsonObject { put("type", "object"); putJsonObject("properties") {} },
    ) { PluginToolResult.text(jsonString(mapOf("session" to status(host)))) }

    private fun threadListTool(host: PluginHost) = PluginTool(
        name = "zanao_thread_list",
        label = "zanao_thread_list",
        description = "集市帖子列表：thread_id / 标题 / 作者昵称 / 头像 / 是否匿名 / 分类 / 互动数。",
        parameters = pageParams(defaultPerPage = 10),
    ) { call ->
        val page = call.args["page"]?.jsonPrimitive?.intOrNull ?: 1
        val per = call.args["per_page"]?.jsonPrimitive?.intOrNull ?: 10
        val obj = call(host, "/thread/v2/list", jsonString(mapOf("page" to page, "per_page" to per)))
        PluginToolResult.text(jsonString(listResult(obj)))
    }

    private fun searchTool(host: PluginHost) = PluginTool(
        name = "zanao_search",
        label = "zanao_search",
        description = "按关键词搜索集市帖子（标题/正文命中）。",
        parameters = buildJsonObject {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("keyword") { put("type", "string") }
                putJsonObject("page") { put("type", "integer") }
                putJsonObject("per_page") { put("type", "integer") }
            }
            putJsonArray("required") { add(JsonPrimitive("keyword")) }
        },
    ) { call ->
        val kw = call.args["keyword"]?.jsonPrimitive?.content.orEmpty()
        val page = call.args["page"]?.jsonPrimitive?.intOrNull ?: 1
        val per = call.args["per_page"]?.jsonPrimitive?.intOrNull ?: 10
        var obj = call(host, "/thread/search", jsonString(mapOf("keyword" to kw, "page" to page, "per_page" to per)))
        if (errno(obj) != 0) {
            obj = call(host, "/thread/v2/search", jsonString(mapOf("keyword" to kw, "page" to page, "per_page" to per)))
        }
        PluginToolResult.text(jsonString(mapOf("keyword" to kw, "result" to listResult(obj))))
    }

    private fun harvestTool(host: PluginHost) = PluginTool(
        name = "zanao_harvest",
        label = "zanao_harvest",
        description = "批量收割 + 无关信息过滤：翻多页列表，按关键词打分、标题去重、丢噪声与低互动帖，返回排序候选集。keyword 用空格/逗号分隔多个词。",
        parameters = buildJsonObject {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("keyword") { put("type", "string") }
                putJsonObject("pages") { put("type", "integer") }
                putJsonObject("per_page") { put("type", "integer") }
                putJsonObject("min_likes") { put("type", "integer") }
                putJsonObject("min_comments") { put("type", "integer") }
                putJsonObject("limit") { put("type", "integer") }
            }
        },
    ) { call ->
        val kw = call.args["keyword"]?.jsonPrimitive?.content.orEmpty()
        val pages = call.args["pages"]?.jsonPrimitive?.intOrNull ?: 3
        val per = call.args["per_page"]?.jsonPrimitive?.intOrNull ?: 20
        val minLikes = call.args["min_likes"]?.jsonPrimitive?.intOrNull ?: 0
        val minComments = call.args["min_comments"]?.jsonPrimitive?.intOrNull ?: 0
        val limit = call.args["limit"]?.jsonPrimitive?.intOrNull ?: 20
        PluginToolResult.text(jsonString(harvest(host, kw, pages, per, minLikes, minComments, limit)))
    }

    private fun threadInfoTool(host: PluginHost) = PluginTool(
        name = "zanao_thread_info",
        label = "zanao_thread_info",
        description = "帖子详情：标题、正文、作者昵称/头像、联系方式字段。",
        parameters = buildJsonObject {
            put("type", "object")
            putJsonObject("properties") {
                putJsonObject("id") { put("type", "string") }
            }
            putJsonArray("required") { add(JsonPrimitive("id")) }
        },
    ) { call ->
        val id = call.args["id"]?.jsonPrimitive?.content.orEmpty()
        val obj = call(host, "/thread/info", jsonString(mapOf("id" to id)))
        val detail = obj?.jsonObject?.get("data")?.jsonObject?.get("detail")?.jsonObject
        val picked = detail?.let { d ->
            mapOf(
                "thread_id" to (d["thread_id"]?.jsonPrimitive?.content ?: ""),
                "title" to (d["title"]?.jsonPrimitive?.content ?: ""),
                "content" to (d["content"]?.jsonPrimitive?.content ?: ""),
                "nickname" to (d["nickname"]?.jsonPrimitive?.content ?: ""),
                "headimgurl" to (d["headimgurl"]?.jsonPrimitive?.content ?: ""),
                "is_anon" to (d["is_anon"]?.jsonPrimitive?.content ?: ""),
                "contact_person" to (d["contact_person"]?.jsonPrimitive?.content ?: ""),
                "contact_phone" to (d["contact_phone"]?.jsonPrimitive?.content ?: ""),
                "contact_qq" to (d["contact_qq"]?.jsonPrimitive?.content ?: ""),
            )
        } ?: emptyMap()
        PluginToolResult.text(jsonString(mapOf("errno" to errno(obj), "detail" to picked)))
    }

    // ---------------- helpers ----------------

    private val json = Json { ignoreUnknownKeys = true }

    private fun skillMarkdown(host: PluginHost): String {
        val fromAssets = runCatching {
            host.assetsDir.resolve("$SKILL_ASSET_DIR/SKILL.md").readText()
        }.getOrNull()
        if (!fromAssets.isNullOrBlank()) return fromAssets
        return host.context.assets.open("$SKILL_ASSET_DIR/SKILL.md").bufferedReader().use { it.readText() }
    }

    private suspend fun call(host: PluginHost, path: String, data: String): JsonElement? {
        val cookie = host.secrets().get(COOKIE_KEY).orEmpty()
        val headers = mutableMapOf(
            "X-Sc-Client" to "h5",
            "Content-Type" to "application/json",
            "Accept" to "application/json",
        )
        if (cookie.isNotEmpty()) headers["Cookie"] = cookie
        val resp = host.network().post(BASE + path, data, headers)
        return runCatching { json.parseToJsonElement(resp.body) }.getOrNull()
    }

    private suspend fun status(host: PluginHost): Map<String, Any?> {
        val obj = call(host, "/user/v1/profile", "{}")
        return mapOf("errno" to errno(obj), "needs_login" to (errno(obj) == 20))
    }

    private fun errno(obj: JsonElement?): Int? = obj?.jsonObject?.get("errno")?.jsonPrimitive?.intOrNull

    private fun listResult(obj: JsonElement?): Map<String, Any?> {
        val list = obj?.jsonObject?.get("data")?.jsonObject?.get("list")?.jsonArray ?: JsonArray(emptyList())
        val items = list.mapNotNull { it as? JsonObject }.map { x ->
            mapOf(
                "thread_id" to (x["thread_id"]?.jsonPrimitive?.content ?: ""),
                "title" to (x["title"]?.jsonPrimitive?.content ?: ""),
                "nickname" to (x["nickname"]?.jsonPrimitive?.content ?: ""),
                "headimgurl" to (x["headimgurl"]?.jsonPrimitive?.content ?: ""),
                "is_anon" to (x["is_anon"]?.jsonPrimitive?.content ?: ""),
                "cate_name" to (x["cate_name"]?.jsonPrimitive?.content ?: ""),
                "c_count" to (x["c_count"]?.jsonPrimitive?.content ?: ""),
                "l_count" to (x["l_count"]?.jsonPrimitive?.content ?: ""),
            )
        }
        return mapOf("errno" to errno(obj), "count" to items.size, "items" to items)
    }

    private suspend fun harvest(
        host: PluginHost,
        keyword: String,
        pages: Int,
        perPage: Int,
        minLikes: Int,
        minComments: Int,
        limit: Int,
    ): Map<String, Any?> {
        val terms = keyword.split(Regex("[\\s,，]+")).filter { it.isNotBlank() }
        val noise = Regex("抽奖|接龙|拼单|砍一刀|助力|投票|互赞|打卡签到")
        val stats = mutableMapOf(
            "pages" to 0, "scanned" to 0, "dropped_noise" to 0, "dropped_threshold" to 0,
            "dropped_duplicate" to 0, "dropped_irrelevant" to 0, "kept" to 0,
        )
        val seen = mutableSetOf<String>()
        val pool = mutableListOf<Map<String, String>>()

        for (p in 1..pages) {
            val obj = call(host, "/thread/v2/list", jsonString(mapOf("page" to p, "per_page" to perPage)))
            if (errno(obj) != 0) break
            stats["pages"] = (stats["pages"] ?: 0).toInt() + 1
            val list = obj?.jsonObject?.get("data")?.jsonObject?.get("list")?.jsonArray ?: JsonArray(emptyList())
            if (list.isEmpty()) break
            for (it in list) {
                val x = it as? JsonObject ?: continue
                stats["scanned"] = (stats["scanned"] ?: 0).toInt() + 1
                val title = x["title"]?.jsonPrimitive?.content ?: ""
                if (noise.containsMatchIn(title)) { stats["dropped_noise"] = (stats["dropped_noise"] ?: 0).toInt() + 1; continue }
                val lc = x["l_count"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                val cc = x["c_count"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                if (lc < minLikes || cc < minComments) { stats["dropped_threshold"] = (stats["dropped_threshold"] ?: 0).toInt() + 1; continue }
                val key = title.replace(Regex("[\\s\\W_]+"), "").lowercase()
                if (key.isEmpty()) { stats["dropped_irrelevant"] = (stats["dropped_irrelevant"] ?: 0).toInt() + 1; continue }
                if (!seen.add(key)) { stats["dropped_duplicate"] = (stats["dropped_duplicate"] ?: 0).toInt() + 1; continue }
                pool.add(
                    mapOf(
                        "thread_id" to (x["thread_id"]?.jsonPrimitive?.content ?: ""),
                        "title" to title,
                        "nickname" to (x["nickname"]?.jsonPrimitive?.content ?: ""),
                        "cate_name" to (x["cate_name"]?.jsonPrimitive?.content ?: ""),
                        "c_count" to cc.toString(),
                        "l_count" to lc.toString(),
                    ),
                )
            }
        }

        val scored = pool.map { row ->
            val title = row["title"].orEmpty()
            var score = 0
            val hits = mutableListOf<String>()
            for (t in terms) {
                if (title.lowercase().contains(t.lowercase())) { score += 3; hits.add(t) }
            }
            row + mapOf("score" to score.toString(), "hits" to hits.joinToString(","))
        }.let { rows ->
            if (terms.isEmpty()) rows else rows.filter { (it["score"]?.toIntOrNull() ?: 0) > 0 }
        }.sortedByDescending {
            (it["score"]?.toIntOrNull() ?: 0)
        }

        val kept = scored.take(limit)
        stats["dropped_irrelevant"] = (stats["dropped_irrelevant"] ?: 0).toInt() + (pool.size - scored.size)
        stats["kept"] = kept.size

        return mapOf("keyword" to keyword, "stats" to stats, "items" to kept)
    }

    private fun jsonString(v: Any?): String = when (v) {
        null -> "{}"
        is Map<*, *> -> buildJsonObject {
            v.forEach { (k, value) -> put(k.toString(), toJson(value)) }
        }.toString()
        else -> v.toString()
    }

    private fun toJson(v: Any?): JsonElement = when (v) {
        null -> JsonPrimitive(null)
        is String -> JsonPrimitive(v)
        is Number -> JsonPrimitive(v)
        is Boolean -> JsonPrimitive(v)
        is Map<*, *> -> buildJsonObject { v.forEach { (k, value) -> put(k.toString(), toJson(value)) } }
        is List<*> -> kotlinx.serialization.json.JsonArray(v.map { toJson(it) })
        else -> JsonPrimitive(v.toString())
    }

    private fun pageParams(defaultPerPage: Int) = buildJsonObject {
        put("type", "object")
        putJsonObject("properties") {
            putJsonObject("page") { put("type", "integer") }
            putJsonObject("per_page") { put("type", "integer"); put("default", defaultPerPage) }
        }
    }

    private companion object {
        const val BASE = "https://c.zanao.com/sc-api"
        const val COOKIE_KEY = "zanao_cookie"
        const val SKILL_ID = "zanao"
        const val SKILL_ASSET_DIR = "skills/zanao"
    }
}
