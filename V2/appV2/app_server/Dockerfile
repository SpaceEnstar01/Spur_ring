# Existing private base used by the ACK build platform; no Docker Hub pulls.
FROM aed-acr-registry-vpc.cn-hangzhou.cr.aliyuncs.com/base/node:20.16-alinux3 AS build
USER root
RUN dnf -y install java-17-openjdk-devel curl tar gzip && dnf clean all
RUN curl -fsSL --connect-timeout 20 --max-time 180 --retry 3 \
      https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.11/apache-maven-3.9.11-bin.tar.gz \
      -o /tmp/apache-maven.tar.gz \
    && echo 'bcfe4fe305c962ace56ac7b5fc7a08b87d5abd8b7e89027ab251069faebee516b0ded8961445d6d91ec1985dfe30f8153268843c89aa392733d1a3ec956c9978  /tmp/apache-maven.tar.gz' | sha512sum -c - \
    && tar -xzf /tmp/apache-maven.tar.gz -C /opt \
    && rm /tmp/apache-maven.tar.gz
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
ENV PATH="/opt/apache-maven-3.9.11/bin:/usr/lib/jvm/java-17-openjdk/bin:${PATH}"
WORKDIR /workspace
COPY pom.xml ./
COPY src ./src
RUN mvn --version && mvn -B -ntp clean verify

FROM aed-acr-registry-vpc.cn-hangzhou.cr.aliyuncs.com/base/node:20.16-alinux3
USER root
RUN dnf -y install java-17-openjdk-headless shadow-utils \
    && dnf clean all \
    && groupadd -g 10001 spur \
    && useradd -u 10001 -g spur -M -s /sbin/nologin spur
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk
ENV PATH="/usr/lib/jvm/java-17-openjdk/bin:${PATH}"
WORKDIR /app
COPY --from=build --chown=spur:spur /workspace/target/my-app-server-0.1.0.jar /app/server.jar
ENV SERVER_ADDRESS=0.0.0.0 PORT=8080
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=65.0", "-jar", "/app/server.jar"]
