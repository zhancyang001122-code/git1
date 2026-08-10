# Housing History API

这是小智项目的独立历史房源查询服务。它以只读方式查询现有 SQLite + R-Tree 数据库，通过稳定的 HTTP 契约返回 2024-11 杭州租房历史快照。

它不是实时房源服务，也不承诺记录当前仍可出租或价格仍有效。服务不会把数据库文件、内部自增 ID、`raw` 字段或联系方式返回给调用方。

## 1. 本地配置

需要 Python 3.12 或更高版本：

```powershell
cd services/housing-api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
Copy-Item .env.example .env
```

编辑 `.env`：

- `HOUSING_DB_PATH`：现有 `nearby_housing.db` 的绝对路径。
- `HOUSING_API_KEY`：至少 32 字符的随机密钥。

`.env` 和数据库均被 Git 忽略。

## 2. 启动

```powershell
python -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --env-file .env
```

只监听 `127.0.0.1`，避免把本地数据库服务意外暴露到局域网。

健康检查：

```powershell
Invoke-RestMethod http://127.0.0.1:8000/health
```

## 3. 查询

```powershell
$headers = @{ Authorization = "Bearer <HOUSING_API_KEY>" }
$body = @{
  city = "杭州"
  center = @{
    lat = 30.2741
    lng = 120.1551
    coordinate_system = "WGS84"
    label = "武林广场"
  }
  radius_m = 2000
  filters = @{
    price_min = $null
    price_max = 4000
    rent_type = "整租"
    layout = "2室"
    area_min = $null
    area_max = $null
    district = $null
  }
  sort = "distance"
  limit = 5
} | ConvertTo-Json -Depth 5

Invoke-RestMethod `
  -Method Post `
  -Uri http://127.0.0.1:8000/v1/houses/search `
  -Headers $headers `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```

## 4. 测试

```powershell
python -m pytest -q
python -m ruff check .
python -m mypy
```

测试使用临时小型数据库，不依赖或修改真实数据库。真实库验收应额外核对查询前后的文件哈希一致。

## 5. 当前边界

- 数据只覆盖杭州，时间为 2024-11。
- 坐标必须是 WGS84；高德地理编码返回 GCJ-02，未来接入时必须转换。
- 宠物政策字段不可靠，因此 API 不接受宠物筛选。
- 当前只提供附近搜索；房源列表与详情页仍由 Web 项目的 Demo/Supabase Repository 负责。
- 公网部署需要另行确认数据再分发许可、托管环境、HTTPS 和密钥管理。
