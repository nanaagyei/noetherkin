import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = file => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const write = (file, value) => fs.writeFileSync(path.join(root, file), `${JSON.stringify(value, null, 2)}\n`);
const checkedAt = '2026-09-17T12:00:00Z';

const additions = [
  ['frontend.web-platform', 'frontend', 'web platform', 'Implement browser behavior using documented platform semantics and verify compatibility boundaries.'],
  ['frontend.accessibility', 'frontend', 'accessibility', 'Test keyboard, semantic, and assistive-technology behavior against an explicit accessibility requirement.'],
  ['frontend.state-management', 'frontend', 'state management', 'Model client state ownership and demonstrate correct transitions under asynchronous updates.'],
  ['frontend.performance', 'frontend', 'frontend performance', 'Measure a user-facing performance bottleneck and validate a targeted improvement.'],
  ['fullstack.end-to-end-delivery', 'fullstack', 'end-to-end delivery', 'Trace and deliver one behavior across interface, service, and persistence boundaries.'],
  ['data.orchestration', 'data', 'data orchestration', 'Design and operate retryable data workflows with observable dependencies and failure recovery.'],
  ['data.batch-streaming', 'data', 'batch and streaming', 'Choose batch or streaming semantics and test lateness, replay, and ordering assumptions.'],
  ['database.query-planning', 'database', 'query planning', 'Explain a query plan and validate an index or rewrite against measured behavior.'],
  ['database.storage-engines', 'database', 'storage engines', 'Trace persistence, caching, and recovery behavior through a storage engine.'],
  ['sre.slo-error-budgets', 'sre', 'SLOs and error budgets', 'Define a measurable service objective and use its error budget to justify an operational decision.'],
  ['sre.capacity-planning', 'sre', 'capacity planning', 'Estimate capacity from workload evidence and test the first saturation assumption.'],
  ['sre.incident-management', 'sre', 'incident management', 'Coordinate diagnosis, mitigation, and follow-up using a timestamped incident record.'],
  ['observability.instrumentation', 'observability', 'instrumentation', 'Add telemetry that answers a stated operational question without misleading cardinality or sampling.'],
  ['observability.telemetry-pipelines', 'observability', 'telemetry pipelines', 'Trace collection, processing, export, and loss behavior across a telemetry pipeline.'],
  ['security.threat-modeling', 'security', 'threat modeling', 'Identify assets, trust boundaries, abuse paths, and testable mitigations for a concrete change.'],
  ['security.secure-development', 'security', 'secure development', 'Implement and test secure defaults at an identified trust boundary.'],
  ['security.vulnerability-management', 'security', 'vulnerability management', 'Triage a finding using reachability, impact, fix evidence, and residual risk.'],
  ['appsec.static-dynamic-analysis', 'appsec', 'static and dynamic analysis', 'Configure and validate analysis findings while documenting false-positive and coverage limits.'],
  ['appsec.web-security', 'appsec', 'web security', 'Reproduce and remediate a web vulnerability with regression evidence.'],
  ['tooling.cli-design', 'tooling', 'CLI design', 'Design stable command behavior including diagnostics, exit status, and automation-safe output.'],
  ['tooling.static-analysis', 'tooling', 'static analysis', 'Implement or tune a deterministic rule and validate precision on positive and negative cases.'],
  ['tooling.build-systems', 'tooling', 'build systems', 'Trace dependency and cache behavior through a reproducible build.'],
  ['compiler.parsing-lowering', 'compiler', 'parsing and lowering', 'Trace source syntax into an intermediate representation and test invalid input behavior.'],
  ['compiler.optimization', 'compiler', 'compiler optimization', 'Implement or analyze a semantics-preserving optimization with counterexamples.'],
  ['compiler.codegen', 'compiler', 'code generation', 'Trace an intermediate representation into target code and validate target-specific behavior.'],
  ['quality.test-strategy', 'quality', 'test strategy', 'Select test layers from failure risk and state what each layer cannot prove.'],
  ['quality.automation', 'quality', 'quality automation', 'Build a deterministic quality check with actionable failure output.'],
  ['quality.reliability', 'quality', 'reliability testing', 'Design repeatable tests for concurrency, recovery, or environmental failure.'],
  ['mobile.platform-integration', 'mobile', 'platform integration', 'Implement and test behavior across shared code and a native platform boundary.'],
  ['mobile.performance', 'mobile', 'mobile performance', 'Measure and improve startup, rendering, memory, or network behavior on a target device profile.'],
  ['mobile.release', 'mobile', 'mobile release', 'Produce a reproducible signed release candidate and document rollout and rollback constraints.'],
  ['embedded.real-time', 'embedded', 'real-time behavior', 'Measure timing behavior and validate a deadline or scheduling assumption.'],
  ['embedded.hardware-interfaces', 'embedded', 'hardware interfaces', 'Implement and test a device interface with explicit electrical or protocol assumptions.'],
  ['embedded.resource-constraints', 'embedded', 'resource constraints', 'Measure memory, power, or compute use and validate operation within a fixed budget.'],
  ['network.protocols', 'network', 'network protocols', 'Trace protocol state and reproduce timeout, retry, or malformed-message behavior.'],
  ['network.routing-proxying', 'network', 'routing and proxying', 'Configure and diagnose routing across naming, proxy, and load-balancing boundaries.'],
  ['network.tls', 'network', 'TLS', 'Explain and test certificate, identity, negotiation, and failure behavior for a secured connection.'],
  ['game.engine-architecture', 'game', 'game engine architecture', 'Trace frame, scene, asset, and system ownership through an engine change.'],
  ['game.rendering', 'game', 'rendering', 'Implement or diagnose a rendering path using measurable frame and visual evidence.'],
  ['game.performance', 'game', 'game performance', 'Profile frame time or resource use and validate a targeted optimization.']
];
const competencyCatalog = read('catalog/competencies.yaml');
for (const [id, domain, name, observable_behavior] of additions) {
  if (!competencyCatalog.competencies.some(item => item.id === id)) competencyCatalog.competencies.push({ id, domain, name, observable_behavior, required_core: false });
}
write('catalog/competencies.yaml', competencyCatalog);

const projectSpecs = [
  ['textual','Textual','https://github.com/Textualize/textual','Textualize',['Python'],['frontend'],['frontend.web-platform','frontend.accessibility'],'bounded','low','fast','verified','Upstream labels explicitly distinguish easy, moderate, and hard issues and include good-first issues.'],
  ['ruff','Ruff','https://github.com/astral-sh/ruff','astral-sh',['Rust'],['tooling'],['tooling.static-analysis','tooling.cli-design'],'bounded','medium','fast','verified','The upstream contribution guide identifies good-first issues that usually need no significant Ruff or Rust experience.'],
  ['uv','uv','https://github.com/astral-sh/uv','astral-sh',['Rust'],['tooling'],['tooling.cli-design','tooling.build-systems'],'moderate','medium','moderate','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['astro','Astro','https://github.com/withastro/astro','withastro',['TypeScript'],['frontend'],['frontend.web-platform','frontend.accessibility'],'bounded','medium','fast','verified','The upstream contribution guide welcomes contributions at all experience levels and publishes contribution entry points.'],
  ['dagster','Dagster','https://github.com/dagster-io/dagster','dagster-io',['Python','TypeScript'],['data'],['data.orchestration','data.quality'],'moderate','medium','moderate','verified','The upstream contribution guide explicitly directs newcomers to good-first issues.'],
  ['apache-airflow','Apache Airflow','https://github.com/apache/airflow','apache',['Python'],['data'],['data.orchestration','data.batch-streaming'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['postgresql','PostgreSQL','https://github.com/postgres/postgres','postgres',['C'],['database'],['database.query-planning','database.storage-engines'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['sqlite','SQLite','https://github.com/sqlite/sqlite','sqlite',['C'],['database'],['database.query-planning','database.storage-engines'],'moderate','medium','fast','unverified','The GitHub repository is a mirror; contribution workflow requires separate verification.'],
  ['caddy','Caddy','https://github.com/caddyserver/caddy','caddyserver',['Go'],['network'],['network.routing-proxying','network.tls'],'moderate','medium','fast','verified','The upstream issue tracker publishes current good-first contribution candidates.'],
  ['coredns','CoreDNS','https://github.com/coredns/coredns','coredns',['Go'],['network'],['network.protocols','network.routing-proxying'],'moderate','medium','moderate','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['envoy','Envoy','https://github.com/envoyproxy/envoy','envoyproxy',['C++'],['network'],['network.routing-proxying','network.tls'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['opentelemetry-collector','OpenTelemetry Collector','https://github.com/open-telemetry/opentelemetry-collector','open-telemetry',['Go'],['observability'],['observability.instrumentation','observability.telemetry-pipelines'],'moderate','medium','moderate','verified','The upstream guide orders issue labels by complexity and documents contributor prerequisites.'],
  ['grafana','Grafana','https://github.com/grafana/grafana','grafana',['Go','TypeScript'],['observability'],['observability.instrumentation','frontend.web-platform'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['loki','Loki','https://github.com/grafana/loki','grafana',['Go'],['observability'],['observability.telemetry-pipelines','distributed.partitioning'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['trivy','Trivy','https://github.com/aquasecurity/trivy','aquasecurity',['Go'],['security'],['security.vulnerability-management','appsec.static-dynamic-analysis'],'moderate','medium','moderate','verified','Upstream documentation provides a dedicated contribution workflow for security checks.'],
  ['semgrep','Semgrep','https://github.com/semgrep/semgrep','semgrep',['OCaml','Python'],['security'],['tooling.static-analysis','appsec.static-dynamic-analysis'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['sops','SOPS','https://github.com/getsops/sops','getsops',['Go'],['security'],['security.secure-development','network.tls'],'moderate','medium','fast','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['owasp-juice-shop','OWASP Juice Shop','https://github.com/juice-shop/juice-shop','juice-shop',['TypeScript'],['appsec'],['appsec.web-security','security.threat-modeling'],'bounded','low','fast','verified','The upstream repository publishes a contributor guide and intentionally vulnerable learning surface.'],
  ['zaproxy','ZAP','https://github.com/zaproxy/zaproxy','zaproxy',['Java'],['appsec'],['appsec.web-security','appsec.static-dynamic-analysis'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['rust-clippy','Rust Clippy','https://github.com/rust-lang/rust-clippy','rust-lang',['Rust'],['tooling','compiler'],['tooling.static-analysis','compiler.parsing-lowering'],'moderate','high','moderate','verified','The upstream guide identifies mentored, good-first, and easy issue categories.'],
  ['biome','Biome','https://github.com/biomejs/biome','biomejs',['Rust','TypeScript'],['tooling'],['tooling.static-analysis','compiler.parsing-lowering'],'moderate','medium','fast','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['vitest','Vitest','https://github.com/vitest-dev/vitest','vitest-dev',['TypeScript'],['quality'],['quality.automation','quality.test-strategy'],'bounded','low','fast','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['playwright','Playwright','https://github.com/microsoft/playwright','microsoft',['TypeScript'],['quality'],['quality.automation','quality.reliability'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['flutter','Flutter','https://github.com/flutter/flutter','flutter',['Dart'],['mobile'],['mobile.platform-integration','mobile.performance'],'complex','high','slow','unverified','Contribution entry points and host-platform requirements were not independently verified for this catalog release.'],
  ['expo','Expo','https://github.com/expo/expo','expo',['TypeScript'],['mobile'],['mobile.platform-integration','mobile.release'],'moderate','medium','moderate','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['react-native','React Native','https://github.com/facebook/react-native','facebook',['C++','JavaScript'],['mobile'],['mobile.platform-integration','mobile.performance'],'complex','high','slow','unverified','Contribution entry points and host-platform requirements were not independently verified for this catalog release.'],
  ['zephyr','Zephyr','https://github.com/zephyrproject-rtos/zephyr','zephyrproject-rtos',['C'],['embedded'],['embedded.real-time','embedded.hardware-interfaces'],'complex','specialized','specialized','verified','The upstream contribution page publishes good-first issues; hardware needs still vary by task.'],
  ['micropython','MicroPython','https://github.com/micropython/micropython','micropython',['C','Python'],['embedded'],['embedded.hardware-interfaces','embedded.resource-constraints'],'moderate','specialized','specialized','unverified','Contribution entry points and hardware needs were not independently verified for this catalog release.'],
  ['bevy','Bevy','https://github.com/bevyengine/bevy','bevyengine',['Rust'],['game'],['game.engine-architecture','game.rendering'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['godot','Godot','https://github.com/godotengine/godot','godotengine',['C++'],['game'],['game.engine-architecture','game.rendering'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['raylib','raylib','https://github.com/raysan5/raylib','raysan5',['C'],['game'],['game.rendering','game.performance'],'bounded','medium','fast','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['pygame','Pygame','https://github.com/pygame/pygame','pygame',['C','Python'],['game'],['game.engine-architecture','game.performance'],'bounded','medium','fast','unverified','Contribution entry points were not independently verified for this catalog release.'],
  ['textlint','textlint','https://github.com/textlint/textlint','textlint',['TypeScript'],['tooling'],['tooling.static-analysis','quality.automation'],'bounded','low','fast','verified','The upstream contribution guide recommends good-first issues to new contributors.'],
  ['online-boutique','Google Online Boutique','https://github.com/GoogleCloudPlatform/microservices-demo','GoogleCloudPlatform',['Go','C#','JavaScript','Python','Java'],['backend','platform','distributed'],['backend.networking','platform.kubernetes','production.observability'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.',['Kubernetes','Istio','gRPC']],
  ['opentelemetry-cpp','OpenTelemetry C++','https://github.com/open-telemetry/opentelemetry-cpp','open-telemetry',['C++'],['observability','systems'],['cpp.build-tooling','observability.instrumentation','production.tracing'],'complex','high','slow','unverified','Contribution entry points were not independently verified for this catalog release.',['OpenTelemetry','CMake','Bazel']],
  ['triton-inference-server','NVIDIA Triton Inference Server','https://github.com/triton-inference-server/server','triton-inference-server',['Python','C++'],['ml','llm','gpu'],['ml.serving','llm.batching','llm.latency-throughput','gpu.profiling'],'complex','specialized','specialized','unverified','Contribution entry points were not independently verified for this catalog release.',['NVIDIA Triton Inference Server','Docker','HTTP','gRPC']]
];

const verifiedSources = {
  textual:'https://github.com/Textualize/textual/labels',
  ruff:'https://github.com/astral-sh/ruff/blob/main/CONTRIBUTING.md',
  astro:'https://github.com/withastro/astro/blob/main/CONTRIBUTING.md',
  dagster:'https://github.com/dagster-io/dagster/blob/master/docs/docs/about/contributing.md',
  caddy:'https://github.com/caddyserver/caddy/issues',
  'opentelemetry-collector':'https://github.com/open-telemetry/opentelemetry-collector/blob/main/CONTRIBUTING.md',
  trivy:'https://github.com/aquasecurity/trivy/blob/main/docs/community/contribute/checks/overview.md',
  'owasp-juice-shop':'https://github.com/juice-shop/juice-shop/blob/master/CONTRIBUTING.md',
  'rust-clippy':'https://github.com/rust-lang/rust-clippy/blob/master/CONTRIBUTING.md',
  zephyr:'https://github.com/zephyrproject-rtos/zephyr/contribute',
  textlint:'https://github.com/textlint/textlint/blob/master/docs/CONTRIBUTING.md'
};
const levelFor = difficulty => difficulty === 'bounded' ? ['E0','E1'] : difficulty === 'moderate' ? ['E1','E2'] : ['E2','E3'];
const recordFor = spec => {
  const [id,name,repository_url,upstream_organization,primary_languages,engineering_domains,specialties,difficulty,onboarding_cost,feedback_loop,status,signal,technologies = ['Repository-specific']] = spec;
  const [recommended_minimum_level, ideal_level] = levelFor(difficulty);
  const verified = status === 'verified';
  return { schema_version:'3.0', data_class:'live', id, name, repository_url, upstream_organization,
    description:`Upstream ${name} repository recorded as an advisory learning candidate. Entry metadata is editorial guidance and does not imply upstream endorsement.`,
    primary_languages, technologies, engineering_domains,
    competencies:['core.codebase-navigation','core.testing',...specialties], recommended_minimum_level, ideal_level,
    prerequisites:['Ability to follow the repository build instructions and run a focused validation loop'], difficulty,
    onboarding_cost, feedback_loop,
    contribution_readiness:{ status, signals:[signal], limitations: verified ? ['Issue suitability and maintainer availability can change after the catalog check.'] : [signal] },
    onboarding_areas:['Repository documentation','Source layout','Tests and contribution workflow'],
    learning_paths:[{ name:'Repository investigation', competencies:['core.codebase-navigation',specialties[0]], activities:['Map one behavior using source citations.','Identify and run the narrowest documented validation loop.'] }],
    deployment:null, contribution:null, status:'candidate',
    caveats:['Difficulty, onboarding cost, feedback loop, and level fit are editorial guidance, not upstream endorsements or E-level gates.','Candidate metadata does not claim task-pack support or live simulator task support.'],
    sources:[{ uri:repository_url, description:'Repository identity and upstream provenance.', revision:'catalog-observation-2026-09-17' }, ...(verifiedSources[id] ? [{ uri:verifiedSources[id], description:signal, revision:'catalog-observation-2026-09-17' }] : [])],
    checked_at:checkedAt, metadata_gaps:[...(verified?[]:['contribution_readiness']),'deployment','contribution'], support:{ attachable:true, task_packs:[] } };
};
for (const spec of projectSpecs) write(`catalog/projects/${spec[0]}.yaml`, recordFor(spec));

const bounded = new Set(['pytest','fastapi','pandas','duckdb','jupyterlab','scikit-learn','sympy','scipy','jq','ripgrep','pytorch-examples','cuda-samples','localstack','opentofu','prometheus']);
const complex = new Set(['airbyte','cockroachdb','cutlass','etcd','huggingface-transformers','jax','kserve','kubernetes','llvm-project','openmetadata','pytorch','sample-eks-inference-platform','tikv','triton','vllm']);
for (const file of fs.readdirSync(path.join(root,'catalog/projects')).filter(name => name.endsWith('.yaml'))) {
  const project = read(`catalog/projects/${file}`);
  if (project.onboarding_cost !== undefined) continue;
  const difficulty = bounded.has(project.id) ? 'bounded' : complex.has(project.id) ? 'complex' : 'moderate';
  const [minimum, ideal] = levelFor(difficulty);
  project.difficulty = difficulty; project.recommended_minimum_level = minimum; project.ideal_level = ideal;
  project.prerequisites = ['Ability to follow the repository build instructions and run a focused validation loop'];
  project.onboarding_cost = difficulty === 'bounded' ? 'low' : difficulty === 'moderate' ? 'medium' : 'high';
  project.feedback_loop = difficulty === 'bounded' ? 'fast' : difficulty === 'moderate' ? 'moderate' : 'slow';
  const supported = project.status === 'supported';
  project.contribution_readiness = { status:supported?'verified':'unverified', signals:[supported?'Bundled project-specific task pack provides a checked local entry surface.':'Repository identity is recorded and the checkout is attachable.'], limitations:[supported?'Upstream issue availability can change independently of the bundled task pack.':'Upstream contribution entry points were not independently verified for this catalog release.'] };
  project.caveats = [...new Set([...(project.caveats??[]),'Difficulty, onboarding cost, feedback loop, and level fit are editorial guidance, not upstream endorsements or E-level gates.'])];
  project.metadata_gaps = supported ? [] : ['contribution_readiness','deployment','contribution'];
  write(`catalog/projects/${file}`, project);
}

const tracks = [
  ['frontend-engineering','Frontend Engineering',['frontend.web-platform','frontend.accessibility','frontend.state-management','frontend.performance'],['textual','textlint'],['astro','biome'],['playwright','backstage']],
  ['full-stack-engineering','Full-Stack Engineering',['fullstack.end-to-end-delivery','frontend.web-platform','backend.http-api','backend.databases'],['fastapi','astro'],['django','opentelemetry-demo'],['cockroachdb','kubernetes']],
  ['data-engineering','Data Engineering',['data.sql','data.quality','data.orchestration','data.batch-streaming'],['duckdb','dbt-core'],['dagster','airbyte'],['apache-airflow','openmetadata']],
  ['database-engineering','Database Engineering',['backend.databases','database.query-planning','database.storage-engines','distributed.transactions'],['sqlite','duckdb'],['postgresql','redis'],['cockroachdb','tikv']],
  ['site-reliability-engineering','Site Reliability Engineering',['sre.slo-error-budgets','sre.capacity-planning','sre.incident-management','production.observability'],['prometheus','opentelemetry-demo'],['grafana','loki'],['kubernetes','opentelemetry-collector']],
  ['observability-engineering','Observability Engineering',['observability.instrumentation','observability.telemetry-pipelines','production.observability','production.tracing'],['opentelemetry-demo','prometheus'],['grafana','opentelemetry-collector'],['loki','kubernetes']],
  ['security-engineering','Security Engineering',['security.threat-modeling','security.secure-development','security.vulnerability-management','network.tls'],['trivy','sops'],['semgrep','zaproxy'],['envoy','kubernetes']],
  ['application-security','Application Security',['appsec.static-dynamic-analysis','appsec.web-security','security.threat-modeling','security.secure-development'],['owasp-juice-shop','semgrep'],['trivy','zaproxy'],['envoy','kubernetes']],
  ['developer-tooling','Developer Tooling',['tooling.cli-design','tooling.static-analysis','tooling.build-systems','quality.automation'],['textlint','vitest'],['ruff','biome'],['uv','rust-clippy']],
  ['compiler-engineering','Compiler Engineering',['compiler.parsing-lowering','compiler.optimization','compiler.codegen','cpp.memory'],['rust-clippy','ruff'],['triton','jax'],['llvm-project','pytorch']],
  ['quality-engineering','Quality Engineering',['quality.test-strategy','quality.automation','quality.reliability','production.reliability'],['pytest','vitest'],['playwright','owasp-juice-shop'],['opentelemetry-demo','kubernetes']],
  ['mobile-engineering','Mobile Engineering',['mobile.platform-integration','mobile.performance','mobile.release','frontend.state-management'],['expo','react-native'],['flutter','playwright'],['react-native','flutter']],
  ['embedded-systems','Embedded Systems',['embedded.real-time','embedded.hardware-interfaces','embedded.resource-constraints','cpp.memory'],['micropython','zephyr'],['cuda-samples','raylib'],['llvm-project','cutlass']],
  ['network-engineering','Network Engineering',['network.protocols','network.routing-proxying','network.tls','backend.networking'],['caddy','coredns'],['opentelemetry-demo','envoy'],['kubernetes','etcd']],
  ['game-engineering','Game Engineering',['game.engine-architecture','game.rendering','game.performance','cpp.memory'],['pygame','raylib'],['bevy','godot'],['llvm-project','cuda-samples']]
];
for (const [id,name,required_competencies,early,intermediate,advanced] of tracks) write(`catalog/tracks/${id}.yaml`, { schema_version:'3.0', catalog_version:'1.1', id, name, description:`A curated ${name.toLowerCase()} path that guides competency scope and project discovery without granting capability.`, outcomes:[`Build and explain increasingly complex ${name.toLowerCase()} systems using attributable evidence.`], required_competencies, recommended_projects:{early,intermediate,advanced} });
for (const file of fs.readdirSync(path.join(root,'catalog/tracks')).filter(name => name.endsWith('.yaml'))) {
  const track = read(`catalog/tracks/${file}`); track.catalog_version = '1.1'; write(`catalog/tracks/${file}`, track);
}
