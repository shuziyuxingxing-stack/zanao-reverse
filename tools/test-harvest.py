import importlib.util, json, sys
p = r"C:\Users\数字与星星\.dsh\skills\zanao\web\zanao_web.py"
spec = importlib.util.spec_from_file_location("zw", p)
zw = importlib.util.module_from_spec(spec); spec.loader.exec_module(zw)

PAGES = {
    1: [
        {"thread_id": 1, "title": "考研自习室占座问题严重", "l_count": 40, "c_count": 12, "cate_name": "吐槽"},
        {"thread_id": 2, "title": "考研自习室占座问题严重！！", "l_count": 5, "c_count": 2, "cate_name": "吐槽"},  # 去重应淘汰
        {"thread_id": 3, "title": "【抽奖】转发抽奶茶", "l_count": 200, "c_count": 50, "cate_name": "活动"},          # 噪声
        {"thread_id": 4, "title": "求推荐考研资料", "l_count": 8, "c_count": 3, "cate_name": "求助"},
        {"thread_id": 5, "title": "出二手台灯", "l_count": 1, "c_count": 0, "cate_name": "二手"},                    # 无关
    ],
    2: [
        {"thread_id": 6, "title": "图书馆空调太冷", "l_count": 3, "c_count": 1, "cate_name": "吐槽"},                # 无关
    ],
}
BODY = {
    "4": "自习室相关的复习资料整理，附考研自习室分布",   # 标题无命中，正文命中 → 靠 fetch_detail 救回
}

class FakeW:
    def call(self, path, data=None, method="POST"):
        if path == "/thread/v2/list":
            return {"json": {"errno": 0, "data": {"list": PAGES.get(data["page"], [])}}}
        if path == "/thread/info":
            return {"json": {"errno": 0, "data": {"detail": {"content": BODY.get(str(data["id"]), "")}}}}
        return {"json": {"errno": 3}}

res = zw.harvest(FakeW(), keyword="考研 自习室", pages=2, per_page=10, fetch_detail=5, sleep_s=0)
print(json.dumps(res, ensure_ascii=False, indent=2))