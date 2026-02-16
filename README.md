# GitHub Local Pilot

一键从 GitHub 页面跳转到本地工作区,自动管理 Git worktree。

## 功能特性

- **一键跳转**: 在 GitHub Issue/PR/Branch/Repo/Tag 页面点击按钮,自动在本地创建对应的 worktree
- **列表快捷入口**: 在 Issue/PR/Branch/Tag 列表页面,每行显示快捷图标,直接打开对应项目
- **Create PR 快捷入口**: 在 Issue 评论中的 "Create PR" 链接后显示图标,快速打开对应分支
- **Git Worktree 管理**: 每个 Issue/PR/Branch/Tag 独立目录,互不干扰
- **智能目录命名**: 目录名以 `-{repoName}` 为后缀,便于区分不同项目; PR 使用分支名,Tag 使用 `tag-{name}` 格式
- **自动初始化**: 检测项目类型,自动运行 `pnpm i` / `npm i` / `cargo build` 等
- **URL 映射**: 支持正则表达式重写 URL,适配内部工具链
- **跨平台**: 支持 Windows / macOS / Linux

## 安装

### 前置依赖

- [Git](https://git-scm.com/)
- [GitHub CLI](https://cli.github.com/) (需要 `gh auth login` 登录)
- Node.js >= 18

### CLI 安装

```bash
npm config set @white-dragon-tools:registry https://npm.pkg.github.com
npm install @white-dragon-tools/github-local-pilot -g
```

### Chrome 扩展安装

**方式一: 从 Release 下载**

1. 前往 [Releases](../../releases) 页面下载 `chrome-extension.zip`
2. 解压到任意目录
3. 打开 Chrome,访问 `chrome://extensions/`
4. 开启「开发者模式」
5. 点击「加载已解压的扩展程序」,选择解压后的目录

**方式二: 从源码安装**

1. 打开 Chrome,访问 `chrome://extensions/`
2. 开启「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择 `packages/chrome-extension` 目录

### 注册协议处理器

```bash
ghlp register
```

这会注册 `ghlp://` 协议,使浏览器能够调用 CLI。

各平台实现方式:
- **Windows**: 写入注册表 `HKCU\Software\Classes\ghlp`
- **macOS**: 在 `~/Applications/` 创建后台 AppleScript applet (`LSBackgroundOnly`),通过 Launch Services 注册 URL scheme。点击链接时不会抢占焦点,自动在配置的终端中打开,显示 clone 进度并 cd 到目标目录
- **Linux**: 创建 `.desktop` 文件并通过 `xdg-mime` 注册

## 使用方法

### 初始化配置

```bash
ghlp init
```

按提示设置工作区目录(默认 `~/workspace`),支持 `~` 展开,目录不存在时自动创建。

### 打开 GitHub URL

`ghlp open` 执行 git 操作后,将目标目录路径输出到 stdout(进度信息输出到 stderr)。
可配合脚本使用:

```bash
# 直接使用 (快捷方式,自动转为 ghlp open)
ghlp https://github.com/org/repo
ghlp https://github.com/org/repo/tree/feature-branch

# 等价的完整写法
ghlp open https://github.com/org/repo

# 配合 cd 使用
cd "$(ghlp https://github.com/org/repo/tree/feature-branch)"

# 打开 PR
ghlp https://github.com/org/repo/pull/123

# 打开 Issue (创建新分支)
ghlp https://github.com/org/repo/issues/456
```

也可以直接使用 `ghlp://` 协议:

```bash
ghlp ghlp://github.com/org/repo/issues/456
```

**协议处理器自动终端**: 通过浏览器点击 `ghlp://` 链接时,如果配置了 `terminal`,
会通过永久 runner 脚本 (`~/.github-local-pilot/ghlp-runner.sh`) 在终端中执行,
显示 clone 进度,完成后 cd 到目标目录并打开 IDE。

**智能更新检测**: 目录已存在时不执行 `fetch --all`,而是通过本地缓存检测是否落后上游,
有未提交变更或落后 commit 时给出警告。打开目录后自动在后台 fetch 当前分支,
为下次打开提供准确的状态信息。

### 获取工作区路径

```bash
ghlp -w
```

### 清理 Worktree

```bash
# 清理指定仓库中没有远程分支的 worktree
ghlp clean org/repo

# 清理工作区内所有仓库
ghlp clean --all

# 预览将被清理的内容
ghlp clean --all --dry-run
```

## 配置说明

### 全局配置

位置: `~/.github-local-pilot/config.json`

```json
{
  "workspace": "D:\\workspace"
}
```

Runner 脚本: `~/.github-local-pilot/ghlp-runner.sh` (协议处理器使用,自动创建和更新)

### 工作区配置

位置: `{workspace}/.ghlp/config.yaml`

```yaml
# 自动打开 IDE
# 简单模式: 命令后自动追加目录路径
autoOpenIde: code

# 模板模式: 使用 {dir} 占位符自定义命令格式
# autoOpenIde: "myide.exe /d \"{dir}\""
# autoOpenIde: "idea --open {dir}"

# 终端程序 (协议处理器通过此配置打开终端显示进度)
# 简单模式: 命令后自动追加脚本路径
# terminal: "open -a Terminal"
# terminal: "wezterm cli spawn -- bash"
#
# 模板模式: 使用 {dir} 占位符,脚本路径替换 {dir}
# terminal: "/path/to/open-terminal.sh {dir}"

# URL 映射规则
mappings:
  - from: "https://internal-tool.com/issues/(\\d+)"
    to: "https://github.com/org/repo/issues/$1"
    branch: "feature/issue-$1"
```

## URL 映射

映射规则支持正则表达式捕获组:

```yaml
mappings:
  # 将内部工具 URL 映射到 GitHub
  - from: "https://jira.company.com/browse/PROJ-(\\d+)"
    to: "https://github.com/company/project/issues/$1"
    branch: "feature/PROJ-$1"
    originType: issue  # 可选: 指定原始 URL 类型 (pr/issue/branch/tag/repo/external)
  
  # 简化仓库名
  - from: "https://github.com/very-long-org-name/(.+)"
    to: "https://github.com/short/$1"
```

`originType` 字段说明:
- 如果原始 URL 是 GitHub 地址,会自动推断类型 (pr/issue/branch/tag/repo)
- 如果原始 URL 是外部地址且未配置 `originType`,默认为 `external`
- 该字段会记录在 `.ghlp-metadata.json` 中,用于追踪来源

## 目录结构

工作区目录组织方式:

```
workspace/
├── .ghlp/
│   └── config.yaml                # 工作区配置
├── org/
│   └── repo/
│       ├── main-repo/             # 主仓库 (git clone)
│       ├── feature-branch-repo/   # 分支 worktree
│       ├── feature-xxx-repo/      # PR worktree (使用 PR 分支名)
│       ├── issue-456-repo/        # Issue worktree
│       └── tag-v1.0.0-repo/       # Tag worktree
└── another-org/
    └── another-repo/
        └── main-another-repo/
```

每个 worktree 目录下会生成 `.ghlp-metadata.json` 记录来源信息, 需要添加到 .gitignore.

## 开发

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 类型检查
pnpm lint
```

## License

MIT
