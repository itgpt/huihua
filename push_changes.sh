#!/bin/bash

# 进入项目目录
cd /home/user/code/huihua

# 检查目录
echo "当前目录: $(pwd)"
echo "Git 状态:"
git status

# 添加所有更改
echo "添加所有更改..."
git add . --all

# 提交更改
echo "提交更改..."
git commit -m "Add comprehensive Git ignore rules and VS Code configuration"

# 推送到 GitHub
echo "推送到 GitHub..."
git push origin main

echo "完成！"