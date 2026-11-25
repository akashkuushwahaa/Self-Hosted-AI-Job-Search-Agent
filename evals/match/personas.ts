import type { MatchProfile } from "../../lib/match";

// Fictional candidates spanning seniority, region and specialty.
export const personas: Record<string, MatchProfile> = {
  "intern-frontend-india": {
    headline: "Final-year CS student, full-stack web developer",
    location: "Ahmedabad, India (open to remote)",
    yearsExperience: 1,
    skills: ["TypeScript", "JavaScript", "React", "Next.js", "Node.js", "Tailwind CSS", "PostgreSQL", "Python", "Git"],
    targetRoles: ["Software Engineer Intern", "Frontend Engineer Intern", "New Grad Full-stack Engineer"],
    resumeText:
      "B.E. Computer Science, graduating 2027. SDE intern (3 months): built dashboard features in Next.js and React, Zustand state, Zod validation, REST APIs. Projects: job search app with Next.js and Postgres; LLM code-review tool in Python with FastAPI.",
  },
  "senior-backend-europe": {
    headline: "Senior backend and platform engineer",
    location: "Berlin, Germany (EU remote welcome)",
    yearsExperience: 8,
    skills: ["Go", "Kubernetes", "PostgreSQL", "Kafka", "AWS", "Terraform", "gRPC", "Distributed systems", "Observability"],
    targetRoles: ["Senior Backend Engineer", "Staff Software Engineer", "Platform Engineer"],
    resumeText:
      "8 years building backend services. Led migration of a payments platform to Kubernetes on AWS; designed Kafka event pipelines processing 50k msg/s; on-call lead; mentored 5 engineers. Go, PostgreSQL, Terraform, Prometheus.",
  },
  "ml-engineer-us": {
    headline: "Machine learning engineer, LLM applications",
    location: "San Francisco, CA",
    yearsExperience: 4,
    skills: ["Python", "PyTorch", "LLMs", "RAG", "Model evaluation", "Fine-tuning", "Spark", "SQL", "AWS SageMaker"],
    targetRoles: ["Machine Learning Engineer", "Applied AI Engineer", "Research Engineer"],
    resumeText:
      "4 years in ML. Built retrieval-augmented support assistant serving 2M queries/month; owned offline eval harness for LLM features; fine-tuned 7B models with LoRA; feature pipelines in Spark. M.S. Computer Science.",
  },
};
