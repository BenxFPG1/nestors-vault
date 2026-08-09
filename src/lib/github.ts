/**
 * Start de tag-workflow op GitHub Actions (draait op het Claude-abonnement).
 *
 * Vereist GITHUB_ACTIONS_TOKEN in de omgeving: een fine-grained PAT met
 * "Actions: Read and write" op de vault-repo. Zonder token geeft dit rustig
 * `false` terug, zodat de aanroeper op de API-route kan terugvallen.
 */
const REPO = "BenxFPG1/nestors-vault";
const WORKFLOW = "tag.yml";
const BRANCH = "master";

export async function startTagWorkflow(): Promise<boolean> {
  const token = process.env.GITHUB_ACTIONS_TOKEN;
  if (!token) return false;

  try {
    const antwoord = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "x-github-api-version": "2022-11-28",
        },
        body: JSON.stringify({ ref: BRANCH }),
      },
    );
    return antwoord.status === 204;
  } catch {
    return false;
  }
}
