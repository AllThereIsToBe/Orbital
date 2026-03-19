import {
  buildWorkflowInput,
  createSeedState,
  type AIProvider,
  type AIProviderKind,
  type AppState,
  type WorkflowDefinition,
  type WorkflowRole,
  type WorkflowRunResult
} from "@orbital/domain";
import { useEffect, useMemo, useState, type Dispatch } from "react";

import { RichContent } from "../../components/RichContent";
import { SectionHeader } from "../../components/SectionHeader";
import { runWorkflow } from "../../lib/openAiCompatible";
import { formatDateTime } from "../../lib/time";
import type { AppAction } from "../../lib/usePersistentAppState";

interface AIControlCenterProps {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  runServerWorkflow?: (
    workflowId: string,
    courseId: string | undefined,
    userBrief: string
  ) => Promise<WorkflowRunResult>;
  canUseServer: boolean;
  embedded?: boolean;
}

const providerTemplates = createSeedState().providers;
const providerKinds = providerTemplates.map((provider) => ({
  kind: provider.kind,
  label: provider.name
}));
const workflowRoles: WorkflowRole[] = [
  "router",
  "retriever",
  "vision",
  "synthesizer",
  "quizzer",
  "tutor",
  "planner"
];

const cloneProvider = (provider: AIProvider, suffix: string): AIProvider => ({
  ...provider,
  id: `provider-${crypto.randomUUID()}`,
  name: `${provider.name} ${suffix}`,
  enabled: false,
  apiKey: "",
  extraHeaders: (provider.extraHeaders || []).map((header) => ({ ...header })),
  capabilities: { ...provider.capabilities }
});

const createProviderFromKind = (kind: AIProviderKind, state: AppState): AIProvider => {
  const template =
    providerTemplates.find((provider) => provider.kind === kind) ??
    providerTemplates.find((provider) => provider.kind === "openai-compatible") ??
    providerTemplates[0];
  const count = state.providers.filter((provider) => provider.kind === kind).length + 1;

  return cloneProvider(template, count > 1 ? `${count}` : "Custom");
};

const updateWorkflow = (
  workflow: WorkflowDefinition,
  dispatch: Dispatch<AppAction>,
  updater: (current: WorkflowDefinition) => WorkflowDefinition
) => {
  dispatch({
    type: "upsertWorkflow",
    workflow: updater({
      ...workflow,
      steps: workflow.steps.map((step) => ({ ...step })),
      stepIds: [...workflow.stepIds]
    })
  });
};

const updateCapability = (
  provider: AIProvider,
  capability: keyof AIProvider["capabilities"],
  nextValue: boolean
) => ({
  ...provider.capabilities,
  [capability]: nextValue
});

export const AIControlCenter = ({
  state,
  dispatch,
  runServerWorkflow,
  canUseServer,
  embedded = false
}: AIControlCenterProps) => {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(state.workflows[0]?.id ?? "");
  const [selectedCourseId, setSelectedCourseId] = useState(state.courses[0]?.id ?? "");
  const [brief, setBrief] = useState("");
  const [output, setOutput] = useState("");
  const [runMeta, setRunMeta] = useState("");
  const [error, setError] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  const selectedWorkflow = state.workflows.find((workflow) => workflow.id === selectedWorkflowId);
  const providerOptions = useMemo(
    () =>
      state.providers.map((provider) => ({
        value: provider.id,
        label: `${provider.name}${provider.enabled ? "" : " (disabled)"}`
      })),
    [state.providers]
  );
  const unresolvedStepNames = useMemo(
    () =>
      selectedWorkflow
        ? selectedWorkflow.steps
            .filter((step) => !state.providers.find((provider) => provider.id === step.providerId && provider.enabled))
            .map((step) => step.name)
        : [],
    [selectedWorkflow, state.providers]
  );

  useEffect(() => {
    if (!state.workflows.some((workflow) => workflow.id === selectedWorkflowId)) {
      setSelectedWorkflowId(state.workflows[0]?.id ?? "");
    }
  }, [selectedWorkflowId, state.workflows]);

  useEffect(() => {
    if (!state.courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(state.courses[0]?.id ?? "");
    }
  }, [selectedCourseId, state.courses]);

  const executeWorkflow = async () => {
    if (!selectedWorkflow) {
      return;
    }

    setIsRunning(true);
    setOutput("");
    setError("");

    try {
      const result =
        canUseServer && runServerWorkflow
          ? await runServerWorkflow(selectedWorkflow.id, selectedCourseId || undefined, brief)
          : await runWorkflow({
              providers: state.providers,
              workflow: selectedWorkflow,
              input: buildWorkflowInput(state, selectedWorkflow.id, selectedCourseId || undefined, brief)
            });

      setOutput(
        result.steps
          .map((step) => `## ${step.name}\n\n${step.output}`)
          .join("\n\n")
      );
      setRunMeta(`Completed ${formatDateTime(result.completedAt)} using ${result.steps.length} workflow step(s).`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Workflow failed.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="view">
      {!embedded ? (
        <SectionHeader
          eyebrow="AI"
          title="Keep the model layer modular and inspectable."
          description="Providers, workflows, and prompts live as explicit configuration so you can swap APIs, route work, and inspect each stage of the pipeline."
        />
      ) : null}

      <section className="two-column-grid">
        <div className="stack">
          <div className="card">
            <h2>Providers</h2>
            <p className="muted">
              Add as many provider configs as you want, including multiple entries for the same API family.
            </p>
            <p className="muted">
              API keys and custom headers stay out of synced app snapshots. Orbital keeps them separate from the shared provider config.
            </p>
            <div className="tag-picker">
              {providerKinds.map((entry) => (
                <button
                  key={entry.kind}
                  className="secondary-button"
                  onClick={() =>
                    dispatch({
                      type: "addProvider",
                      provider: createProviderFromKind(entry.kind, state)
                    })
                  }
                  type="button"
                >
                  Add {entry.label}
                </button>
              ))}
            </div>
            <div className="provider-list">
              {state.providers.map((provider) => (
                <div key={provider.id} className="provider-card">
                  <div className="task-card-row">
                    <strong>{provider.name}</strong>
                    <div className="action-row">
                      <button
                        className="secondary-button"
                        onClick={() =>
                          dispatch({
                            type: "addProvider",
                            provider: cloneProvider(
                              provider,
                              `${state.providers.filter((item) => item.kind === provider.kind).length + 1}`
                            )
                          })
                        }
                        type="button"
                      >
                        Duplicate
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          dispatch({
                            type: "removeProvider",
                            providerId: provider.id
                          })
                        }
                        type="button"
                      >
                        Remove
                      </button>
                      <label className="switch">
                        <input
                          checked={provider.enabled}
                          onChange={(event) =>
                            dispatch({
                              type: "updateProvider",
                              providerId: provider.id,
                              patch: { enabled: event.target.checked }
                            })
                          }
                          type="checkbox"
                        />
                        <span>{provider.enabled ? "Enabled" : "Disabled"}</span>
                      </label>
                    </div>
                  </div>

                  <div className="field-grid">
                    <label className="field">
                      <span>Name</span>
                      <input
                        value={provider.name}
                        onChange={(event) =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: { name: event.target.value }
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Provider family</span>
                      <select
                        value={provider.kind}
                        onChange={(event) =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: { kind: event.target.value as AIProviderKind }
                          })
                        }
                      >
                        {providerKinds.map((entry) => (
                          <option key={entry.kind} value={entry.kind}>
                            {entry.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Mode</span>
                      <select
                        value={provider.mode}
                        onChange={(event) =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: {
                              mode: event.target.value as AIProvider["mode"]
                            }
                          })
                        }
                      >
                        <option value="remote">Remote</option>
                        <option value="local">Local</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Base URL</span>
                      <input
                        value={provider.baseUrl}
                        onChange={(event) =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: { baseUrl: event.target.value }
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>API version</span>
                      <input
                        placeholder="Optional"
                        value={provider.apiVersion || ""}
                        onChange={(event) =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: { apiVersion: event.target.value || undefined }
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>Model</span>
                      <input
                        value={provider.model}
                        onChange={(event) =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: { model: event.target.value }
                          })
                        }
                      />
                    </label>
                    <label className="field">
                      <span>API key</span>
                      <input
                        placeholder={provider.mode === "local" ? "Optional for local endpoints" : ""}
                        type="password"
                        value={provider.apiKey}
                        onChange={(event) =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: { apiKey: event.target.value }
                          })
                        }
                      />
                    </label>
                  </div>

                  <div className="provider-subsection">
                    <div className="task-card-row">
                      <strong>Extra headers</strong>
                      <button
                        className="secondary-button"
                        onClick={() =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: {
                              extraHeaders: [...(provider.extraHeaders || []), { key: "", value: "" }]
                            }
                          })
                        }
                        type="button"
                      >
                        Add header
                      </button>
                    </div>
                    {(provider.extraHeaders || []).length === 0 ? (
                      <p className="muted">No custom headers configured.</p>
                    ) : (
                      <div className="provider-list">
                        {(provider.extraHeaders || []).map((header, index) => (
                          <div key={`${provider.id}-header-${index}`} className="provider-inline-grid">
                            <input
                              placeholder="Header name"
                              value={header.key}
                              onChange={(event) => {
                                const next = (provider.extraHeaders || []).map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, key: event.target.value } : item
                                );
                                dispatch({
                                  type: "updateProvider",
                                  providerId: provider.id,
                                  patch: { extraHeaders: next }
                                });
                              }}
                            />
                            <input
                              placeholder="Header value"
                              value={header.value}
                              onChange={(event) => {
                                const next = (provider.extraHeaders || []).map((item, itemIndex) =>
                                  itemIndex === index ? { ...item, value: event.target.value } : item
                                );
                                dispatch({
                                  type: "updateProvider",
                                  providerId: provider.id,
                                  patch: { extraHeaders: next }
                                });
                              }}
                            />
                            <button
                              className="secondary-button"
                              onClick={() =>
                                dispatch({
                                  type: "updateProvider",
                                  providerId: provider.id,
                                  patch: {
                                    extraHeaders: (provider.extraHeaders || []).filter(
                                      (_item, itemIndex) => itemIndex !== index
                                    )
                                  }
                                })
                              }
                              type="button"
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="tag-picker">
                    {Object.entries(provider.capabilities).map(([capability, value]) => (
                      <button
                        key={capability}
                        className={`tag-toggle ${value ? "is-selected" : ""}`}
                        onClick={() =>
                          dispatch({
                            type: "updateProvider",
                            providerId: provider.id,
                            patch: {
                              capabilities: updateCapability(
                                provider,
                                capability as keyof AIProvider["capabilities"],
                                !value
                              )
                            }
                          })
                        }
                        type="button"
                      >
                        {capability}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="task-card-row">
              <h2>Workflow routing</h2>
              <button
                className="secondary-button"
                disabled={!selectedWorkflow}
                onClick={() => {
                  if (!selectedWorkflow) {
                    return;
                  }

                  const steps = selectedWorkflow.steps.map((step) => ({
                    ...step,
                    id: crypto.randomUUID()
                  }));
                  const copy: WorkflowDefinition = {
                    ...selectedWorkflow,
                    id: `workflow-${crypto.randomUUID()}`,
                    name: `${selectedWorkflow.name} Copy`,
                    stepIds: steps.map((step) => step.id),
                    steps
                  };

                  dispatch({ type: "upsertWorkflow", workflow: copy });
                  setSelectedWorkflowId(copy.id);
                }}
                type="button"
              >
                Duplicate workflow
              </button>
            </div>

            <div className="field-grid single-column">
              <label className="field">
                <span>Workflow</span>
                <select
                  value={selectedWorkflowId}
                  onChange={(event) => setSelectedWorkflowId(event.target.value)}
                >
                  {state.workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </label>
              {selectedWorkflow ? (
                <>
                  <label className="field">
                    <span>Name</span>
                    <input
                      value={selectedWorkflow.name}
                      onChange={(event) =>
                        updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                          ...workflow,
                          name: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Description</span>
                    <textarea
                      rows={3}
                      value={selectedWorkflow.description}
                      onChange={(event) =>
                        updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                          ...workflow,
                          description: event.target.value
                        }))
                      }
                    />
                  </label>
                  <label className="field">
                    <span>Input mode</span>
                    <select
                      value={selectedWorkflow.inputMode}
                      onChange={(event) =>
                        updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                          ...workflow,
                          inputMode: event.target.value as WorkflowDefinition["inputMode"]
                        }))
                      }
                    >
                      <option value="course-material">Course material</option>
                      <option value="selected-materials">Selected materials</option>
                      <option value="manual-brief">Manual brief</option>
                    </select>
                  </label>
                  <div className="provider-list">
                    {selectedWorkflow.steps.map((step, index) => (
                      <div key={step.id} className="provider-card">
                        <div className="task-card-row">
                          <strong>Step {index + 1}</strong>
                          <button
                            className="secondary-button"
                            disabled={selectedWorkflow.steps.length === 1}
                            onClick={() =>
                              updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                                ...workflow,
                                steps: workflow.steps.filter((item) => item.id !== step.id),
                                stepIds: workflow.stepIds.filter((id) => id !== step.id)
                              }))
                            }
                            type="button"
                          >
                            Remove step
                          </button>
                        </div>
                        <div className="field-grid">
                          <label className="field">
                            <span>Step name</span>
                            <input
                              value={step.name}
                              onChange={(event) =>
                                updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                                  ...workflow,
                                  steps: workflow.steps.map((item) =>
                                    item.id === step.id ? { ...item, name: event.target.value } : item
                                  )
                                }))
                              }
                            />
                          </label>
                          <label className="field">
                            <span>Role</span>
                            <select
                              value={step.role}
                              onChange={(event) =>
                                updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                                  ...workflow,
                                  steps: workflow.steps.map((item) =>
                                    item.id === step.id
                                      ? { ...item, role: event.target.value as WorkflowRole }
                                      : item
                                  )
                                }))
                              }
                            >
                              {workflowRoles.map((role) => (
                                <option key={role} value={role}>
                                  {role}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className="field">
                            <span>Provider</span>
                            <select
                              value={step.providerId}
                              onChange={(event) =>
                                updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                                  ...workflow,
                                  steps: workflow.steps.map((item) =>
                                    item.id === step.id
                                      ? { ...item, providerId: event.target.value }
                                      : item
                                  )
                                }))
                              }
                            >
                              {providerOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <label className="field">
                          <span>System prompt</span>
                          <textarea
                            rows={4}
                            value={step.systemPrompt}
                            onChange={(event) =>
                              updateWorkflow(selectedWorkflow, dispatch, (workflow) => ({
                                ...workflow,
                                steps: workflow.steps.map((item) =>
                                  item.id === step.id
                                    ? { ...item, systemPrompt: event.target.value }
                                    : item
                                )
                              }))
                            }
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() =>
                      updateWorkflow(selectedWorkflow, dispatch, (workflow) => {
                        const fallbackProvider =
                          workflow.steps.at(-1)?.providerId || state.providers[0]?.id || "";
                        const stepId = crypto.randomUUID();
                        return {
                          ...workflow,
                          steps: [
                            ...workflow.steps,
                            {
                              id: stepId,
                              name: "New step",
                              role: "synthesizer",
                              providerId: fallbackProvider,
                              systemPrompt: "Describe what this step should do."
                            }
                          ],
                          stepIds: [...workflow.stepIds, stepId]
                        };
                      })
                    }
                    type="button"
                  >
                    Add step
                  </button>
                </>
              ) : (
                <p className="muted">No workflows available.</p>
              )}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>Workflow runner</h2>
            <div className="field-grid single-column">
              <label className="field">
                <span>Workflow</span>
                <select
                  value={selectedWorkflowId}
                  onChange={(event) => setSelectedWorkflowId(event.target.value)}
                >
                  {state.workflows.map((workflow) => (
                    <option key={workflow.id} value={workflow.id}>
                      {workflow.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Course context</span>
                <select
                  disabled={selectedWorkflow?.inputMode === "manual-brief"}
                  value={selectedCourseId}
                  onChange={(event) => setSelectedCourseId(event.target.value)}
                >
                  {state.courses.map((course) => (
                    <option key={course.id} value={course.id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Brief</span>
                <textarea
                  placeholder="Example: focus on week 2 transfer maneuvers and generate a revision pack with likely traps."
                  rows={6}
                  value={brief}
                  onChange={(event) => setBrief(event.target.value)}
                />
              </label>

              <button className="primary-button" disabled={isRunning} onClick={executeWorkflow} type="button">
                {isRunning ? "Running..." : "Run workflow"}
              </button>

              {unresolvedStepNames.length > 0 ? (
                <p className="muted">
                  Disabled step routes detected for: {unresolvedStepNames.join(", ")}. Local runs will try an enabled compatible provider first.
                </p>
              ) : null}

              <p className="muted">
                {canUseServer
                  ? "Workflow execution is routed through the Orbital server so providers, retrieval context, and collaborative state stay in one place."
                  : "Browser mode can call local endpoints directly, but hosted APIs may still fail due to CORS or network policy. If that happens, sign in and run through the Orbital server."}
              </p>
              <p className="muted">
                Ollama is optional. The built-in workflows now default to API-capable routing, and you only need Ollama if you explicitly want a local model.
              </p>
            </div>
          </div>

          <div className="card">
            <h2>Run output</h2>
            {runMeta ? <p className="muted">{runMeta}</p> : null}
            {error ? <p className="error-text">{error}</p> : null}
            <div className="output-panel">
              {output ? (
                <RichContent content={output} />
              ) : (
                "Configure at least one enabled provider, then run a workflow."
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
