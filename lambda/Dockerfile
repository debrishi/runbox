FROM public.ecr.aws/lambda/python:3.14

# Toolchains for the four supported languages:
#   clang              -> C++ with AddressSanitizer. clang ships its own ASan
#                         runtime and pulls in libstdc++-devel (the standard
#                         library headers, incl. <bits/stdc++.h>) as a dependency,
#                         so no separate GCC package is needed.
#   Corretto 25        -> Java (javac + java)
#   Node.js 24         -> TypeScript via native type stripping (stable since 23.6)
# The python:3.14 base is Amazon Linux 2023 (glibc 2.34), which Node 24 needs.
RUN dnf update -y && \
    dnf install -y clang && \
    dnf install -y java-25-amazon-corretto-devel && \
    curl -fsSL https://rpm.nodesource.com/setup_24.x | bash - && \
    dnf install -y nodejs && \
    dnf clean all

COPY lambda.py ${LAMBDA_TASK_ROOT}/app.py

CMD ["app.lambda_handler"]
