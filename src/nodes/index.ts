import type { BaseNode, NodeType } from "web-test/nodes/base.ts";
import { MacroNode } from "web-test/nodes/macro.ts";
import { CommentNode } from "web-test/nodes/comment.ts";
import { NavigateNode } from "web-test/nodes/navigate.ts";
import { ClickNode } from "web-test/nodes/click.ts";
import { ScrapeTextNode } from "web-test/nodes/scrape_text.ts";
import { IfNode } from "web-test/nodes/if.ts";
import { ComparisonNode } from "web-test/nodes/comparison.ts";
import { ConditionalValueNode } from "web-test/nodes/conditional_value.ts";
import { TextLiteralNode } from "web-test/nodes/text_literal.ts";
import { BooleanLiteralNode } from "web-test/nodes/boolean_literal.ts";
import { FileReadNode } from "web-test/nodes/file_read.ts";
import { ScriptNode } from "web-test/nodes/script.ts";
import { QuerySelectorNode } from "web-test/nodes/query_selector.ts";
import { QuerySelectorAllNode } from "web-test/nodes/query_selector_all.ts";
import { TextContentNode } from "web-test/nodes/text_content.ts";
import { GetAttributeNode } from "web-test/nodes/get_attribute.ts";
import { SetValueNode } from "web-test/nodes/set_value.ts";
import { TypeTextNode } from "web-test/nodes/type_text.ts";
import { ElementClickNode } from "web-test/nodes/element_click.ts";
import { WaitSelectorNode } from "web-test/nodes/wait_selector.ts";
import { DelayNode } from "web-test/nodes/delay.ts";
import { PageInfoNode } from "web-test/nodes/page_info.ts";
import { ResetBrowserNode } from "web-test/nodes/reset_browser.ts";
import { NumberLiteralNode } from "web-test/nodes/number_literal.ts";
import { JsonParseNode } from "web-test/nodes/json_parse.ts";
import { JsonStringifyNode } from "web-test/nodes/json_stringify.ts";
import { ConsoleTriggerNode } from "web-test/nodes/console_trigger.ts";
import { RemoveListenerNode } from "web-test/nodes/remove_listener.ts";
import { SequenceNode } from "web-test/nodes/sequence.ts";
import { LogNode } from "web-test/nodes/log.ts";
import { StringConcatNode } from "web-test/nodes/string_concat.ts";
import { StringFormatNode } from "web-test/nodes/string_format.ts";
import { ArrayLiteralNode } from "web-test/nodes/array_literal.ts";
import { ArrayCreatorNode } from "web-test/nodes/array_creator.ts";
import { ArrayLengthNode } from "web-test/nodes/array_length.ts";
import { ArrayConcatNode } from "web-test/nodes/array_concat.ts";
import { ArraySliceNode } from "web-test/nodes/array_slice.ts";
import { ArrayAtNode } from "web-test/nodes/array_at.ts";
import { ArrayForEachNode } from "web-test/nodes/array_for_each.ts";
import { ArrayMapNode } from "web-test/nodes/array_map.ts";
import { ArrayFilterNode } from "web-test/nodes/array_filter.ts";
import { ArraySomeNode } from "web-test/nodes/array_some.ts";
import { ArrayEveryNode } from "web-test/nodes/array_every.ts";
import { ArrayReduceNode } from "web-test/nodes/array_reduce.ts";
import { ArrayJoinNode } from "web-test/nodes/array_join.ts";
import { ArrayFromJsonNode } from "web-test/nodes/array_from_json.ts";
import { ArrayToJsonNode } from "web-test/nodes/array_to_json.ts";
import { ElementVariableNode } from "web-test/nodes/element_variable.ts";
import { JsonVariableNode } from "web-test/nodes/json_variable.ts";
import { NumberComparisonNode } from "web-test/nodes/number_comparison.ts";
import { StringLengthNode } from "web-test/nodes/string_length.ts";
import { StringAtNode } from "web-test/nodes/string_at.ts";
import { BooleanAndNode } from "web-test/nodes/boolean_and.ts";
import { BooleanOrNode } from "web-test/nodes/boolean_or.ts";
import { BooleanNotNode } from "web-test/nodes/boolean_not.ts";
import { BooleanXorNode } from "web-test/nodes/boolean_xor.ts";
import { BooleanNandNode } from "web-test/nodes/boolean_nand.ts";
import { BooleanNorNode } from "web-test/nodes/boolean_nor.ts";
import { BooleanXnorNode } from "web-test/nodes/boolean_xnor.ts";
import { WhileNode } from "web-test/nodes/while.ts";
import { ForNode } from "web-test/nodes/for.ts";
import { FailNode } from "web-test/nodes/fail.ts";
import { TryCatchFinallyNode } from "web-test/nodes/try_catch_finally.ts";
/** Constructors for every supported built-in node, indexed by saved node type. */
export const nodeClasses = {
  comment: CommentNode,
  fail: FailNode,
  try_catch_finally: TryCatchFinallyNode,
  macro: MacroNode,
  array_literal: ArrayLiteralNode,
  array_creator: ArrayCreatorNode,
  array_length: ArrayLengthNode,
  array_concat: ArrayConcatNode,
  array_slice: ArraySliceNode,
  array_at: ArrayAtNode,
  array_for_each: ArrayForEachNode,
  array_map: ArrayMapNode,
  array_filter: ArrayFilterNode,
  array_some: ArraySomeNode,
  array_every: ArrayEveryNode,
  array_reduce: ArrayReduceNode,
  array_join: ArrayJoinNode,
  array_from_json: ArrayFromJsonNode,
  array_to_json: ArrayToJsonNode,
  navigate: NavigateNode,
  click: ClickNode,
  extract_text: ScrapeTextNode,
  conditional: IfNode,
  comparison: ComparisonNode,
  conditional_value: ConditionalValueNode,
  text_literal: TextLiteralNode,
  boolean_literal: BooleanLiteralNode,
  file_read: FileReadNode,
  script: ScriptNode,
  query_selector: QuerySelectorNode,
  query_selector_all: QuerySelectorAllNode,
  text_content: TextContentNode,
  get_attribute: GetAttributeNode,
  set_value: SetValueNode,
  type_text: TypeTextNode,
  element_click: ElementClickNode,
  wait_selector: WaitSelectorNode,
  delay: DelayNode,
  page_info: PageInfoNode,
  reset_browser: ResetBrowserNode,
  number_literal: NumberLiteralNode,
  json_parse: JsonParseNode,
  json_stringify: JsonStringifyNode,
  console_trigger: ConsoleTriggerNode,
  remove_listener: RemoveListenerNode,
  sequence: SequenceNode,
  log: LogNode,
  string_concat: StringConcatNode,
  string_format: StringFormatNode,
  element_variable: ElementVariableNode,
  json_variable: JsonVariableNode,
  number_comparison: NumberComparisonNode,
  string_length: StringLengthNode,
  string_at: StringAtNode,
  boolean_and: BooleanAndNode,
  boolean_or: BooleanOrNode,
  boolean_not: BooleanNotNode,
  boolean_xor: BooleanXorNode,
  boolean_nand: BooleanNandNode,
  boolean_nor: BooleanNorNode,
  boolean_xnor: BooleanXnorNode,
  while: WhileNode,
  for: ForNode,
};
/** Display titles for the built-in node catalog, indexed by saved node type. */
export const titles = Object.fromEntries(Object.entries(nodeClasses).map(([key, node]) => [key, node.title])) as Record<NodeType, string>;
/** Editor category names for each built-in node type. */
export const nodeCategories: Record<NodeType, string> = {
  navigate: "Browser",
  click: "Browser",
  page_info: "Browser",
  delay: "Browser",
  reset_browser: "Browser",
  query_selector: "Elements",
  query_selector_all: "Elements",
  wait_selector: "Elements",
  text_content: "Elements",
  get_attribute: "Elements",
  set_value: "Elements",
  type_text: "Elements",
  element_click: "Elements",
  extract_text: "Elements",
  conditional: "Logic",
  comparison: "Logic",
  conditional_value: "Logic",
  text_literal: "Variables",
  boolean_literal: "Variables",
  number_literal: "Variables",
  array_literal: "Variables",
  element_variable: "Variables",
  json_variable: "Variables",
  file_read: "Data",
  json_parse: "Data",
  json_stringify: "Data",
  script: "Scripting",
  console_trigger: "Triggers",
  remove_listener: "Triggers",
  sequence: "Logic",
  log: "Scripting",
  string_concat: "Strings",
  string_format: "Strings",
  array_length: "Arrays",
  array_creator: "Arrays",
  array_concat: "Arrays",
  array_slice: "Arrays",
  array_at: "Arrays",
  array_for_each: "Arrays",
  array_map: "Arrays",
  array_filter: "Arrays",
  array_some: "Arrays",
  array_every: "Arrays",
  array_reduce: "Arrays",
  array_join: "Arrays",
  array_from_json: "Arrays",
  array_to_json: "Arrays",
  number_comparison: "Logic",
  string_length: "Strings",
  string_at: "Strings",
  boolean_and: "Logic",
  boolean_or: "Logic",
  boolean_not: "Logic",
  boolean_xor: "Logic",
  boolean_nand: "Logic",
  boolean_nor: "Logic",
  boolean_xnor: "Logic",
  while: "Loops",
  for: "Loops",
  macro: "Macros",
  fail: "Errors",
  try_catch_finally: "Errors",
  comment: "Notes",
};
/** The concrete node instance for a known type, or BaseNode when the type is the full node-type union. */
export type NodeInstance<Type extends NodeType> = NodeType extends Type ? BaseNode : InstanceType<(typeof nodeClasses)[Type]>;
/** Construct the registered built-in node for a saved type at the supplied workspace coordinates. */
export function createNode<Type extends NodeType>(type: Type, x: number, y: number): NodeInstance<Type> {
  return new nodeClasses[type](x, y) as NodeInstance<Type>;
}
