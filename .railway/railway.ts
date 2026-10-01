import { defineRailway, project, service } from "railway/iac";

// Railway Infrastructure as Code (replaces railway.json). CI applies this with
// `railway config apply` before each deploy; preview changes with `railway config plan`.
// See https://docs.railway.com/infrastructure-as-code

// This repository manages only its own resources in the environment.
export const partial = "initiative-tracker";

export default defineRailway(() => {
  const web = service("initiative-tracker", {
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "Dockerfile",
    },
    deploy: {
      startCommand: "node dist/server/index.cjs",
      healthcheckPath: "/health",
      healthcheckTimeout: 10,
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 3,
      // Sessions live in server memory: exactly one instance, and it must never sleep.
      numReplicas: 1,
      sleepApplication: false,
    },
  });

  return project("initiative-tracker", { resources: [web] });
});
