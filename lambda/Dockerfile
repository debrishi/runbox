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

# ---------- Java AOT Cache (JEP 514 / 515 — Corretto 25) -------------------
# Source-launch mode (`java Main.java`) loads the internal javac compiler on
# every invocation — ~200 classes that take 1-2s to parse + verify + link.
#
# A training run during `docker build` captures all of those classes (plus the
# JDK core) into an AOT cache. At runtime the JVM memory-maps the pre-linked
# metadata and, with JEP 515, also loads pre-recorded method profiles so C1
# can emit optimized code immediately instead of starting from the interpreter.
#
# Net effect: Java source-launch cold-start drops from ~3-4s to ~1-1.5s.
RUN mkdir -p /opt/java-aot && \
    echo 'class Warmup { public static void main(String[] args) { System.out.println("ok"); } }' \
        > /tmp/Warmup.java && \
    java -XX:AOTCacheOutput=/opt/java-aot/source-launch.aot \
         -XX:TieredStopAtLevel=1 -XX:+UseSerialGC \
         /tmp/Warmup.java && \
    rm /tmp/Warmup.java

COPY lambda.py ${LAMBDA_TASK_ROOT}/app.py

CMD ["app.lambda_handler"]
