# Chrome Web Store 图片资源要求

## 图片规格一览

| 图片类型 | 文件名 | 尺寸 (px) | 格式要求 | 是否必填 |
|---|---|---|---|---|
| 商店图标 | `icon_128.png` | **128 × 128** | JPEG 或 24位 PNG（无 alpha 透明层） | ✅ 必填 |
| 屏幕截图 | `screenshot_*.png` | **1280 × 800** 或 **640 × 400** | JPEG 或 24位 PNG（无 alpha 透明层） | ✅ 必填（1-5 张） |
| 小型宣传图块 | `promo_small_440x280.png` | **440 × 280** | JPEG 或 24位 PNG（无 alpha 透明层） | 选填 |
| 顶部宣传图块 | `promo_large_1400x560.png` | **1400 × 560** | JPEG 或 24位 PNG（无 alpha 透明层） | 选填 |

## 详细说明

### 商店图标 (128×128)
- 必须与 `manifest.json` 中的图标风格一致
- 请确保图标符合 [Chrome 图片指南](https://developer.chrome.com/docs/webstore/images)

### 屏幕截图 (1280×800 或 640×400)
- 最少 **1 张**，最多 **5 张**
- 展示扩展的核心功能界面
- 当前文件：
  - `screenshot_main.png` — 主界面（智能整理控制台）
  - `screenshot_review.png` — 审查整理计划界面

### 小型宣传图块 (440×280)
- 用于 Chrome Web Store 搜索结果和分类页面展示
- 应包含扩展名称和核心卖点

### 顶部宣传图块 (1400×560)
- 用于 Chrome Web Store 精选/推荐位展示
- 应包含扩展名称、功能亮点和视觉吸引力强的设计

## 通用注意事项

1. **无 Alpha 通道** — 所有图片必须为 RGB 模式，不能有透明度
2. **尺寸必须精确** — 尺寸不符会被 Chrome Web Store 拒绝上传
3. **文件格式** — 仅支持 JPEG 和 24 位 PNG
4. **设计风格** — 保持蓝白色调，与 AutoMark 品牌一致

## 快速验证命令

使用 Python + Pillow 验证所有图片是否合规：

```bash
python -c "from PIL import Image; import os; d='.'; [print(f'{f}: mode={Image.open(os.path.join(d,f)).mode}, size={Image.open(os.path.join(d,f)).size}') for f in os.listdir(d) if f.endswith(('.png','.jpg'))]"
```

期望输出：
```
icon_128.png: mode=RGB, size=(128, 128)
promo_large_1400x560.png: mode=RGB, size=(1400, 560)
promo_small_440x280.png: mode=RGB, size=(440, 280)
screenshot_main.png: mode=RGB, size=(1280, 800)
screenshot_review.png: mode=RGB, size=(1280, 800)
```
