import type { BaseNode, NodeType } from "web/nodes/base.ts";
import { MacroNode } from "web/nodes/macro.ts";
import { CommentNode } from "web/nodes/comment.ts";
import { NavigateNode } from "web/nodes/navigate.ts";
import { ClickNode } from "web/nodes/click.ts";
import { ScrapeTextNode } from "web/nodes/scrape_text.ts";
import { IfNode } from "web/nodes/if.ts";
import { ComparisonNode } from "web/nodes/comparison.ts";
import { ConditionalValueNode } from "web/nodes/conditional_value.ts";
import { TextLiteralNode } from "web/nodes/text_literal.ts";
import { BooleanLiteralNode } from "web/nodes/boolean_literal.ts";
import { FileReadNode } from "web/nodes/file_read.ts";
import { ScriptNode } from "web/nodes/script.ts";
import { QuerySelectorNode } from "web/nodes/query_selector.ts";
import { QuerySelectorAllNode } from "web/nodes/query_selector_all.ts";
import { TextContentNode } from "web/nodes/text_content.ts";
import { GetAttributeNode } from "web/nodes/get_attribute.ts";
import { SetValueNode } from "web/nodes/set_value.ts";
import { TypeTextNode } from "web/nodes/type_text.ts";
import { ElementClickNode } from "web/nodes/element_click.ts";
import { WaitSelectorNode } from "web/nodes/wait_selector.ts";
import { DelayNode } from "web/nodes/delay.ts";
import { PageInfoNode } from "web/nodes/page_info.ts";
import { ResetBrowserNode } from "web/nodes/reset_browser.ts";
import { NumberLiteralNode } from "web/nodes/number_literal.ts";
import { JsonParseNode } from "web/nodes/json_parse.ts";
import { JsonStringifyNode } from "web/nodes/json_stringify.ts";
import { ConsoleTriggerNode } from "web/nodes/console_trigger.ts";
import { RemoveListenerNode } from "web/nodes/remove_listener.ts";
import { SequenceNode } from "web/nodes/sequence.ts";
import { LogNode } from "web/nodes/log.ts";
import { StringConcatNode } from "web/nodes/string_concat.ts";
import { StringFormatNode } from "web/nodes/string_format.ts";
import { ArrayLiteralNode } from "web/nodes/array_literal.ts";
import { ArrayCreatorNode } from "web/nodes/array_creator.ts";
import { ArrayLengthNode } from "web/nodes/array_length.ts";
import { ArrayConcatNode } from "web/nodes/array_concat.ts";
import { ArraySliceNode } from "web/nodes/array_slice.ts";
import { ArrayAtNode } from "web/nodes/array_at.ts";
import { ArrayForEachNode } from "web/nodes/array_for_each.ts";
import { ArrayMapNode } from "web/nodes/array_map.ts";
import { ArrayFilterNode } from "web/nodes/array_filter.ts";
import { ArraySomeNode } from "web/nodes/array_some.ts";
import { ArrayEveryNode } from "web/nodes/array_every.ts";
import { ArrayReduceNode } from "web/nodes/array_reduce.ts";
import { ArrayJoinNode } from "web/nodes/array_join.ts";
import { ArrayFromJsonNode } from "web/nodes/array_from_json.ts";
import { ArrayToJsonNode } from "web/nodes/array_to_json.ts";
import { ElementVariableNode } from "web/nodes/element_variable.ts";
import { JsonVariableNode } from "web/nodes/json_variable.ts";
import { NumberComparisonNode } from "web/nodes/number_comparison.ts";
import { StringLengthNode } from "web/nodes/string_length.ts";
import { StringAtNode } from "web/nodes/string_at.ts";
import { BooleanAndNode } from "web/nodes/boolean_and.ts";
import { BooleanOrNode } from "web/nodes/boolean_or.ts";
import { BooleanNotNode } from "web/nodes/boolean_not.ts";
import { BooleanXorNode } from "web/nodes/boolean_xor.ts";
import { BooleanNandNode } from "web/nodes/boolean_nand.ts";
import { BooleanNorNode } from "web/nodes/boolean_nor.ts";
import { BooleanXnorNode } from "web/nodes/boolean_xnor.ts";
import { WhileNode } from "web/nodes/while.ts";
import { ForNode } from "web/nodes/for.ts";
import { FailNode } from "web/nodes/fail.ts";
import { TryCatchFinallyNode } from "web/nodes/try_catch_finally.ts";
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
export const titles = Object.fromEntries(Object.entries(nodeClasses).map(([key, node]) => [key, node.title])) as Record<NodeType, string>;
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
export type NodeInstance<Type extends NodeType> = NodeType extends Type ? BaseNode : InstanceType<(typeof nodeClasses)[Type]>;
export function createNode<Type extends NodeType>(type: Type, x: number, y: number): NodeInstance<Type> {
  return new nodeClasses[type](x, y) as NodeInstance<Type>;
}
