# 收藏夹管理器 - 抖音/B站/知乎

一个 Tampermonkey 用户脚本，用于提取和导出抖音、B站、知乎的收藏夹内容。

## 功能特性

- 支持抖音、B站、知乎三大平台
- 自动滚动加载全部收藏内容
- 支持多页翻页提取
- 多种导出格式：TXT、JSON、Markdown
- 一键复制到剪贴板
- 自动去重
## 截图展示
<img src="image.png" width="300" />

## 安装

1. 安装 [Tampermonkey](https://www.tampermonkey.net/) 浏览器扩展
2. 创建新脚本，将 `userscript.js` 内容粘贴进去
3. 保存并启用脚本

## 使用方法

1. 打开对应平台的收藏页面：
   - 抖音：个人主页 → 收藏/喜欢
   - B站：空间 → 收藏夹
   - 知乎：个人主页 → 收藏夹

2. 页面右侧会出现「收藏夹管理器」面板

3. 点击按钮进行操作：
   - **滚动加载全部**：自动滚动并翻页，提取所有收藏
   - **仅提取当前页面**：只提取当前可见的内容
   - **导出**：支持 TXT、JSON、Markdown 格式
   - **复制到剪贴板**：快速复制所有内容

## 导出格式

### Markdown
```markdown
### 1. [视频标题 | UP主](https://www.bilibili.com/video/BVxxxxxx)

### 2. [文章标题](https://www.zhihu.com/question/xxxxx)

- **作者**: 作者名称
```

### JSON
```json
{
  "platform": "B站",
  "exportTime": "2024-01-01T00:00:00.000Z",
  "count": 100,
  "data": [
    {
      "platform": "bilibili",
      "title": "视频标题",
      "url": "https://...",
      "uploader": "UP主名称"
    }
  ]
}
```

### TXT
```
# 收藏夹导出 - B站
# 导出时间: 2024/1/1 00:00:00
# 总数: 100

1. 视频标题
   https://www.bilibili.com/video/BVxxxxxx
```

## 支持的页面

| 平台 | 支持的页面 |
|------|-----------|
| 抖音 | `/collection`, `showTab=favorite`, `showTab=like` |
| B站 | `/favlist`, `/medialist`, `fid=` |
| 知乎 | `/collection`, `/collections` |

## 版本历史

- **v3.0.0** - 优化抖音标题提取，过滤点赞数和无效内容
- **v2.8.0** - 修复B站新版卡片结构的标题提取
- **v2.6.0** - B站导出格式改为 `[标题 | 作者](url)`
- **v2.0.0** - 支持多页翻页提取

## 许可证

MIT License
