// `nodes` contain any nodes you add from the graph (dependencies)
// `root` is a reference to this program's root node
// `state` is an object that persists across program updates. Store data here.
import { root, state } from "membrane";
import { createLanguageModel, createJsonTranslator } from "typechat";

export const Root = {
  status() {
    if (!state.key) {
      return "Please [get an OpenAI API key](https://platform.openai.com/account/api-keys) and [configure](:configure)";
    } else {
      return `Ready`;
    }
  },

  async configure({ key }) {
    for (const id in state) {
      delete state[id];
    }
    state.key = key;
    root.statusChanged.$emit();
  },

  translator(args) {
    return { id: args.id };
  },
};

export const Translator = {
  async translate({ prompt, ...args }, { self }) {
    const { id } = self.$argsAt(root.translator);
    const saved = state[id] ?? { args: {} };

    const model = args.model || saved.args.model;
    if (!model) {
      throw new Error("No model specified");
    }
    const schema = args.schema || saved.args.schema;
    if (!schema) {
      throw new Error("No schema specified");
    }
    const typeName = args.typeName || saved.args.typeName;
    if (!typeName) {
      throw new Error("No typeName specified");
    }

    if (hasModelChanged(saved, args)) {
      console.log(`Recreating ${id} model`);
      const env = {
        OPENAI_API_KEY: state.key,
        OPENAI_MODEL: args.model,
      };
      saved.model = createLanguageModel(env);
      saved.translator = null;
    }

    if (hasSchemaChanged(saved, args)) {
      console.log(`Recreating ${id} translator`);
      saved.translator = createJsonTranslator(
        saved.model,
        args.schema,
        args.typeName
      );
    }

    // Keep args around so they don't need to be passed every time.
    saved.args = { model, schema, typeName };
    state[id] = saved;

    const res = await saved.translator.translate(prompt);
    if (!res.success) {
      const msg = tip(res.message);
      console.log(msg);
      throw new Error(msg);
    }
    return res.data;
  },
};

function hasModelChanged(saved, args) {
  return !saved.model || (args.model && args.model !== saved.args.model);
}

function hasSchemaChanged(saved, args) {
  return (
    !saved.translator ||
    (args.schema && args.schema !== saved.args.schema) ||
    (args.typeName && args.typeName !== saved.args.typeName)
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
