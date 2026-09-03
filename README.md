<!-- markdownlint-disable MD033 MD036 MD041 -->

<div align="center">

![Celeritas Banner](./assets/banner.png)

# Celeritas

_**✨ On the Roche Limit. ⚡**_

</div>

> [!WARNING]
>
> **Celeritas 仅供技术研究、学习交流与自动化编程实践使用。**
>
> 使用者应自行承担因使用 Celeritas 而产生的全部风险，包括但不限于账号异常、选课失效、IP 封锁等。开发者不对因使用、误用 Celeritas 导致的任何直接和间接损失负责。在使用时，请尊重学校的服务器资源、合理设置并发数和请求间隔。
>
> Celeritas 不包含任何针对系统漏洞的恶意攻击载荷，仅模拟正常的人工操作逻辑。

---

## 📖 About

Celeritas 是诞生于「洛希极限」边界的少女，负责在教务系统延迟的裂隙中捕捉一瞬的「空位」。

网速和手速不应成为通往心仪课程的阻隔。Celeritas 想要试图改变这一点，即使她的能力尚且微弱。

## ✨ Features

- 多线程并发请求、多课程逐门请求、智能退避。
- 真实验证、配置持久化、轻量零依赖。
- 多教学班支持、多批次支持、拖拽排序。

支持通识教育选修课（XGKC）、体育俱乐部（TYKC）和推荐班级课程（TJKC）。

## 🚀 Quick Start

将 [`celeritas.user.js`](celeritas.user.js) 导入到 Tampermonkey 即可。

## 🔧 How It Works

选课系统的前端使用 Vue + Element UI。Celeritas 复用已有的 `axios` 实例，自带登录 token，直接调用后端 API。搜索课程、提交选课、验证结果——只在浏览器本地运行，不经过第三方服务器。

提交选课并进入选课队列后，Celeritas 查询已选列表，若找到该课程则继续提交下一门课程，否则重新提交。5 次均未查找到课程时会自动跳过。

## 📁 Project Structure

```text
Celeritas/
├── README.md
├── CHANGELOG.md
├── LICENSE
├── package.json          npm 元数据
├── eslint.config.js      ESLint 配置
├── .prettierrc           Prettier 配置
├── .editorconfig         编辑器配置
├── .gitignore
└── celeritas.user.js     Celeritas
```

## 🛠 Development

```bash
pnpm install     # 安装 ESLint 和 Prettier
pnpm lint        # 检查代码
pnpm format      # 格式化代码
pnpm check       # 格式化和检查代码
```

## 📄 License

[MIT LICENSE](LICENSE).
