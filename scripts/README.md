# Scripts

## `bootstrap-project.sh`

从规格包根目录创建 `web/` Next.js 应用，安装锁定的基础依赖，复制环境变量模板和原型参考。它只做脚手架；具体配置、测试和实现由 Codex 按实施计划完成。

```bash
./scripts/bootstrap-project.sh
```

要求 Node.js 22+ 和 pnpm 10。

## `verify-package.sh`

验证规格包必需文件、JSON、迁移数量、原型数量和未解决占位标记。

```bash
./scripts/verify-package.sh
```

该脚本验证的是 Codex 输入包，不代表尚未创建的 `web/` 应用已经构建或测试通过。
