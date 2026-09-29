/**
 * The graph is the résumé, expressed as a navigable system.
 *
 * Six capability nodes and five experience nodes, wired by the skills each
 * role actually used. One source of truth shared by the 3D scene, the detail
 * panel and the command palette — so hovering a node in WebGL and searching
 * for it in the palette resolve to the same record.
 */

/** Capability nodes — the six competency groups. */
export const CAPABILITIES = [
  {
    id: 'agents',
    short: 'Agents',
    label: 'Multi-Agent Systems',
    detail: 'Designed and deployed production multi-agent systems for observability, incident investigation and code analysis.',
    tags: ['LangChain', 'LangGraph', 'LangSmith', 'Pydantic AI'],
    section: '#skills',
  },
  {
    id: 'mcp',
    short: 'MCP',
    label: 'Model Context Protocol',
    detail: 'Adapted and deployed MCP servers into enterprise infrastructure, enabling dynamic tool discovery and invocation.',
    tags: ['MCP servers', 'Grafana', 'Playwright', 'Tool discovery'],
    section: '#skills',
  },
  {
    id: 'cloud',
    short: 'Cloud',
    label: 'Cloud & Container Infrastructure',
    detail: 'Deployed and operated production agent services with supporting data layers and managed LLM access.',
    tags: ['AWS EKS', 'RDS', 'Bedrock', 'Kubernetes'],
    section: '#skills',
  },
  {
    id: 'observability',
    short: 'Observability',
    label: 'AI Observability',
    detail: 'Grafana dashboards, telemetry pipelines and automated investigation tooling for production AI systems.',
    tags: ['Grafana', 'Telemetry', 'Evaluation', 'Incident tooling'],
    section: '#skills',
  },
  {
    id: 'delivery',
    short: 'Platform',
    label: 'Developer Platforms',
    detail: 'Reusable CI/CD workflows adopted across 20+ repositories, plus repository migration and vulnerability-scanning automation.',
    tags: ['GitHub Actions', 'Reusable workflows', 'Migration', 'Vuln scanning'],
    section: '#skills',
  },
  {
    id: 'fullstack',
    short: 'Full-stack',
    label: 'Full-Stack Development',
    detail: 'Python-first, with hands-on frontend experience shipping the interface on top of the backend.',
    tags: ['Python', 'FastAPI', 'RESTful APIs', 'Next.js'],
    section: '#skills',
  },
];

/** Experience nodes — the five entries on the timeline. */
export const ROLES = [
  {
    id: 'macquarie',
    short: 'Macquarie',
    label: 'Macquarie Group',
    subtitle: 'AI Engineer',
    period: '2025 — Present',
    location: 'Sydney, Australia',
    current: true,
    points: [
      'Built enterprise AI agent infrastructure for observability, evaluation and monitoring of production AI applications.',
      'Deployed agent services on AWS EKS with RDS data layers and Amazon Bedrock LLM access.',
      'Built reusable CI/CD workflows adopted across 20+ repositories.',
      'Built the Bastion security-assessment POC — nominated for two awards among 300+ submissions.',
    ],
    caps: ['agents', 'mcp', 'cloud', 'observability', 'delivery'],
    section: '#experience',
  },
  {
    id: 'synogize',
    short: 'Synogize',
    label: 'Synogize',
    subtitle: 'AI Engineer',
    period: '2024 — 2025',
    location: 'Sydney, Australia',
    points: [
      'Developed multi-agent systems including agentic RAG architectures.',
      'Contributed to system architecture design and technical decision-making.',
      'Researched and compared solutions for Natural Language to SQL translation.',
    ],
    caps: ['agents', 'cloud', 'fullstack'],
    section: '#experience',
  },
  {
    id: 'nuvc',
    short: 'NUVC',
    label: 'NUVC',
    subtitle: 'AI Developer',
    period: '2023 — 2024',
    location: 'Sydney, Australia',
    points: [
      'Built an LLM / LangChain decision-support tool for venture-capital workflows.',
      'Contributed across frontend (Next.js) and backend for seamless system integration.',
    ],
    footnote: 'Part-time side venture — concurrent with the Synogize role.',
    caps: ['agents', 'fullstack'],
    section: '#experience',
  },
  {
    id: 'xiaobing',
    short: 'Xiaobing.ai',
    label: 'Xiaobing.ai',
    subtitle: 'NLP Engineer',
    period: '2021 — 2022',
    location: 'Suzhou, China',
    points: [
      'Built task-oriented chatbots (Rasa) and a general-purpose FAQ platform generating millions of dollars in business value.',
      'Led a supply-and-demand matching platform for government services, generating ≈5M CNY shortly after launch.',
      'Built fuzzy text retrieval and Chinese text-similarity models achieving state-of-the-art performance.',
    ],
    caps: ['fullstack', 'delivery'],
    section: '#experience',
  },
  {
    id: 'usyd',
    short: 'USYD',
    label: 'The University of Sydney',
    subtitle: 'Master of Computer Science',
    period: '2022 — 2024',
    location: 'Sydney, Australia',
    points: [
      'Machine Learning, Deep Learning, NLP, Multimedia Retrieval, Project Management.',
      'Capstone: “Leveraging LLM for Decision Making” — an AI chatbot using LangChain and LLMs with real-time search integration.',
    ],
    caps: ['agents', 'fullstack'],
    section: '#education',
  },
];

/** Everything in one lookup, keyed by id. */
export const ALL_NODES = [...ROLES, ...CAPABILITIES];

export const nodeById = (id) => ALL_NODES.find((node) => node.id === id) ?? null;

/**
 * Edges: each role is wired to the capabilities it exercised. Derived from the
 * data above so the graph can never drift out of sync with the content.
 */
export const EDGES = ROLES.flatMap((role) =>
  role.caps.filter((capId) => nodeById(capId)).map((capId) => ({ from: role.id, to: capId })),
);

/** How many roles reference each capability — used for node weighting. */
export const capabilityWeight = (capId) =>
  ROLES.filter((role) => role.caps.includes(capId)).length;
