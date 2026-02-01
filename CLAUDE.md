任何代码变更后, 更新 README.md 和 cli 的 -h 命令.

**版本发布流程**
- 根 package.json 的 MINOR 版本号 +1
- 所有 packages 里的包, 版本号同步更新
- git add .
- git commit {}
- git tag {ver}
- git push origin {ver}
