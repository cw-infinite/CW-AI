# CW.AI — free-model chat workspace

A React + TypeScript chat application using OpenRouter. This version adds browser-persisted workspaces, Appwrite login, automatic memory, free web research, project downloads, and paged conversation navigation.

## Run locally

Requires Node 22.12+ and npm.

```sh
npm install
npm run dev
```

Open the URL Vite prints (normally `http://localhost:5173/CW-AI/`). In another terminal, start the optional public-page reader:

```sh
npm run server
```

Wikipedia search works without this server. Reading a pasted HTTPS URL needs it. The reader listens only on `127.0.0.1:8787`; Vite proxies `/api/read` to it.

Open Settings and enter your own OpenRouter API key. Select **Free router** or a catalogued `:free` model. Existing paid-model settings must be changed before sending a message. The app refuses paid-model IDs and does not use paid web-search plugins. Free providers still impose availability and rate limits; this does not promise unlimited use. The API key stays in this browser's settings and is never included in a cloud backup. Clear it on shared computers.

## Appwrite setup — one-time console steps

The supplied project is already configured in the client:

- Endpoint: `https://nyc.cloud.appwrite.io/v1`
- Project ID: `6a495da200375e2a8e84`

Optional overrides are in `.env.example`; copy to `.env.local` and restart Vite if changing them. All `VITE_` values are public. **Never put an Appwrite server API key there.**

1. In your Appwrite project, add a **Web platform** for `localhost`. Also add `127.0.0.1` if you open that address. Add your actual deployment hostname before publishing.
2. In **Auth**, enable email/password authentication. Use **Create an account** inside this app, or create an app user in Appwrite Auth. The Appwrite console owner's login is separate from app users.
3. In **Storage**, create a bucket with ID **`workspaces`**. Enable **File security**.
4. Set bucket permissions to **Create: Users** only. Do **not** grant bucket-wide Read, Update, or Delete to Users or Any. Each uploaded file grants Read and Delete only to its owner's user ID. Bucket-wide read would bypass that privacy.
5. Allow the `json` file extension. Set the maximum file size to fit your workspace, for example 50 MB if your Appwrite plan allows it. Backups include image attachments, so watch storage quotas.
6. Sign in, then use **Account & memory → Back up to cloud**. On another device sign in and choose **Restore cloud backup**.

Cloud persistence uses private, versioned JSON files in Appwrite Storage. No database is required. Backup/restore is manual, not automatic multi-device synchronization. Restoring asks before replacing the local workspace. Existing backup versions are not automatically deleted: manage them in Appwrite Storage. Clearing local chats does not delete cloud backups. Server-side access controls depend on the bucket settings above; verify isolation using two test accounts before deployment.

Guest data is kept separate from each account's data. To bring guest chats into your account, export as guest, sign in, then import the file. Import replaces the destination workspace, so export any existing destination data first.

## Using the new tools

- **Web on:** searches English Wikipedia for your message, or reads the first HTTPS URL in it. Use a short search topic for better results. Sources and excerpts appear below the answer. This is reference search/page reading, not a general search engine or autonomous browser. Pages that need login, JavaScript, or anti-bot interaction are unsupported. Search failure is shown rather than silently producing an ungrounded answer. You can switch Web off and retry.
- **Sign in / Memory:** inspect automatically identified preferences, decisions, and topics. Turn automatic recall on/off or forget individual details. There are no memo fields.
- **Automatic recall:** relevant excerpts from older messages and other chats in the same workspace are included when you ask a new question. Existing history works immediately. Forgetting excludes a detail from automatic recall, but does not erase its source message or remove it from recent conversation context. Deleting its source chat removes that source from recall.
- **Build project:** requests complete named files with dependencies and run instructions. Open **Files** to inspect files, download one, or download the ZIP. Later complete revisions replace earlier versions of the same path. Generated code is not executed or tested by this app. The default output ceiling is 16,384 tokens. Change Settings → Maximum response tokens for larger responses; advertised model output limits are applied automatically, while provider and total context limits still apply. Complete file blocks remain downloadable when a response stops early. Ask for remaining files and request that any unfinished file be rewritten in full. Truncated answers are retained as context for follow-up requests. File deletion/renaming across revisions is not inferred.
- **Find a topic / Jump to topic:** navigate directly to a previous user turn. Previous/next page controls keep only 30 messages rendered; **Latest message** returns to the current response.
- **Export workspace:** saves chats and memory without authentication secrets. Import validates records before replacing the workspace.
- **MCP:** Use the MCP button to add, test, enable, refresh, or remove multiple remote Streamable HTTP servers. The app discovers each server’s tools before enabling it. Enabled, read-only tools can be used during a chat; their result is added to the response context and shown in “MCP activity.” Tools not explicitly marked read-only are blocked and the assistant explains that approval is needed. MCP endpoints and optional bearer tokens are stored only in this browser and are not exported or backed up to Appwrite. OAuth connections are not implemented yet. A remote server must permit the app’s origin through CORS; GitHub Pages does not bypass that browser restriction.

## Learn how it works

### 1. The model does not remember by itself

An API call is like handing a new person a folder of information. `src/lib/memory.ts` automatically identifies short user statements about preferences, decisions, and topics. `src/lib/context.ts` prepares a folder containing up to 12 recent messages (24,000 characters total), plus up to six recalled details from older messages and other chats in your workspace. Retrieval weighs matching words, prioritizes rarer topic words, and can include up to two general preferences. Original wording and source dates are retained; the prompt tells the model to prefer current instructions when history conflicts. Assistant guesses are never promoted to user facts. This is local, rule-based extraction and keyword retrieval, not semantic embeddings or AI-written summaries; it may miss paraphrases, long statements, or preferences expressed in unfamiliar phrasing. No extra API requests are used.

Manual memo fields from the previous version are discarded when loading/importing a workspace and are never sent to the model. Automatic memory is derived from your retained chat history; its on/off setting and forgotten-detail exclusions are included in backups. Obvious credentials and code blocks are excluded from automatic extraction as a best-effort filter, not a guarantee that sensitive text will always be detected. The full history remains in browser storage. Reducing the prompt does not delete messages. Character budgets approximate size rather than counting exact model tokens; an unusually small-context model can still reject a request. Images and source text also consume model context. Only the latest user message's images are sent, so historical images remain visible locally but are not repeatedly transmitted.

### 2. Web access belongs to the application

`src/lib/web.ts` fetches references before the LLM request. The text is added to context with instructions to cite sources and treat page text as untrusted data. This works with text models that cannot call tools. It does not make every model equally good at interpreting sources or guarantee correct citations.

Browsers cannot freely read arbitrary sites because of CORS. `server/web.mjs` provides a small HTTPS reader. It checks public IPv4 addresses, pins the validated DNS result to the connection, rechecks redirects, restricts response types, and caps time, response size and concurrent requests. This prevents obvious internal-network fetches. It does not execute page scripts or pass user cookies to pages.

### 3. Authentication and data storage do different jobs

Appwrite Account proves who you are. IndexedDB stores your local workspace. Appwrite Storage stores private cloud backup files. `src/store/useAuthStore.ts` changes workspace when the session changes; `src/lib/workspace.ts` keeps guest and account records separate. No passwords are stored by our application code.

Local storage and session storage are small browser key/value stores; session storage disappears when its tab session ends. IndexedDB usually provides substantially more capacity, is asynchronous, and can store larger histories. Actual quota varies by browser and device. Private browsing, clearing site data, or eviction can still remove it, so export or back up important work. The app shows write errors instead of silently losing data. Existing `cwai:chats` data is migrated lazily into the guest workspace.

### 4. Streaming is many small updates

`src/store/useChatStore.ts` collects tokens and updates React at most about every 60 ms. It saves at the start and end of a turn instead of serializing every conversation on every token. Stop cancels the active request and saves partial text. Closing the tab during generation can lose the unfinished answer; completed turns are retained.

`src/components/MessageList.tsx` only mounts one page of messages. Unchanged message bubbles are memoized. This reduces Markdown and DOM work; it does not make loading an arbitrarily large workspace free. All history is still loaded in memory, and topic indexing scans the conversation. Large attachment-heavy histories may eventually need per-chat database loading.

### 5. Text can become a project archive

In project mode the prompt asks for blocks with a path:

````text
```typescript file=src/main.ts
console.log('Hello');
```
````

`src/lib/projects.ts` extracts complete fenced blocks and rejects unsafe paths such as `../secret`, absolute paths and Windows reserved filenames. It also recognizes filename headings above code and filenames in fence labels. Unnamed code blocks are exported under `snippets/` with language-based extensions and separate folders for each answer. They may need renaming and assembly before they form a runnable project. These rules apply to existing chat responses too: once generation ends, open **Files → Download ZIP**, or select a file and choose **Download file**. Unclosed code blocks are excluded. `ProjectPanel` merges named file revisions; JSZip creates the archive on demand. The ZIP is a collection of generated source files, not proof that the project builds. Run and review it locally.

## Verification

```sh
npm run test
npm run lint
npm run build
```

Tests cover context budgets, file extraction/path safety, import validation, reader address restrictions, account-separated local storage, stream batching/cancellation/retry, research failures, and navigating a 1,000-message conversation.

Live authenticated Appwrite backup/restore requires the console setup and an app-user login. Live OpenRouter generation requires your key. Automated tests mock those calls; do not mistake them for live service validation.

## Deployment

The existing `/CW-AI/` base is retained. Static hosting can run chat, Appwrite, downloads and Wikipedia search. Arbitrary page reading additionally needs a Node service behind your site's `/api/read` route; Vite's development proxy is not included in `dist`. Before exposing that service publicly, put it behind authentication and per-user rate limiting at your hosting gateway. Keep it bound to loopback behind the gateway. This change does not deploy a backend or modify your live Appwrite project.

## Reference documentation

- [OpenRouter free router](https://openrouter.ai/docs/cookbook/get-started/free-models-router-playground)
- [OpenRouter public model catalog](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties)
- [Appwrite Account](https://appwrite.io/docs/references/cloud/client-web/account)
- [Appwrite Storage](https://appwrite.io/docs/references/cloud/client-web/storage)
- [MediaWiki search API](https://www.mediawiki.org/wiki/API:Search)
