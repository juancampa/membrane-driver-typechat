// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { state } from "membrane";
import { createLanguageModel, createJsonTranslator } from "typechat";

export function status() {
  if (!state.key) {
    return "Please [get an OpenAI API key](https://beta.openai.com/account/api-keys) and [configure](:configure)";
  } else {
    return `Ready`;
  }
}

export async function configure({ key }) {
  state.key = key;
  state.model = null;
  state.translator = null;
}

export async function translate(args) {
  if (hasModelChanged(args)) {
    const env = {
      OPENAI_API_KEY: state.key,
      OPENAI_MODEL: args.model,
    };
    state.model = createLanguageModel(env);
    state.translator = null;
  }

  if (hasSchemaChanged(args)) {
    state.translator = createJsonTranslator(
      state.model,
      args.schema,
      args.typeName
    );
  }

  state.lastArgs = args;
  const res = await state.translator.translate(args.prompt);
  if (!res.success) {
    throw new Error(tip(res.message));
  }
  return res.data;
}

function hasModelChanged(args: any) {
  return !state.model || args.model !== state.args?.model;
}

function hasSchemaChanged(args: any) {
  return (
    !state.translator ||
    args.schema !== state.args?.schema ||
    args.typeName !== state.args?.typeName
  );
}

// Enhance typechat errors with potentially helpful tips
function tip(err: any): string {
  let message = err.toString();
  if (/is not a module/.test(message)) {
    message += "\ntip: Consider exporting the target type in the schema";
  }
  if (/is not JSON/.test(message)) {
    message += "\ntip: Consider using an object as the target type";
  }
  return message;
}
