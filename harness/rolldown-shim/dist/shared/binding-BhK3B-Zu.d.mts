declare namespace types_d_exports {
  export { AccessorProperty, AccessorPropertyType, Argument, ArrayAssignmentTarget, ArrayExpression, ArrayExpressionElement, ArrayPattern, ArrowFunctionExpression, AssignmentExpression, AssignmentOperator, AssignmentPattern, AssignmentTarget, AssignmentTargetMaybeDefault, AssignmentTargetPattern, AssignmentTargetProperty, AssignmentTargetPropertyIdentifier, AssignmentTargetPropertyProperty, AssignmentTargetRest, AssignmentTargetWithDefault, AwaitExpression, BigIntLiteral, BinaryExpression, BinaryOperator, BindingIdentifier, BindingPattern, BindingProperty, BindingRestElement, BlockStatement, BooleanLiteral, BreakStatement, CallExpression, CatchClause, ChainElement, ChainExpression, Class, ClassBody, ClassElement, ClassType, ComputedMemberExpression, ConditionalExpression, ContinueStatement, DebuggerStatement, Declaration, Decorator, Directive, DoWhileStatement, EmptyStatement, ExportAllDeclaration, ExportDefaultDeclaration, ExportDefaultDeclarationKind, ExportNamedDeclaration, ExportSpecifier, Expression, ExpressionStatement, ForInStatement, ForOfStatement, ForStatement, ForStatementInit, ForStatementLeft, FormalParameter, FormalParameterRest, Function, FunctionBody, FunctionType, Hashbang, IdentifierName, IdentifierReference, IfStatement, ImportAttribute, ImportAttributeKey, ImportDeclaration, ImportDeclarationSpecifier, ImportDefaultSpecifier, ImportExpression, ImportNamespaceSpecifier, ImportOrExportKind, ImportPhase, ImportSpecifier, JSDocNonNullableType, JSDocNullableType, JSDocUnknownType, JSXAttribute, JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXChild, JSXClosingElement, JSXClosingFragment, JSXElement, JSXElementName, JSXEmptyExpression, JSXExpression, JSXExpressionContainer, JSXFragment, JSXIdentifier, JSXMemberExpression, JSXMemberExpressionObject, JSXNamespacedName, JSXOpeningElement, JSXOpeningFragment, JSXSpreadAttribute, JSXSpreadChild, JSXText, LabelIdentifier, LabeledStatement, LogicalExpression, LogicalOperator, MemberExpression, MetaProperty, MethodDefinition, MethodDefinitionKind, MethodDefinitionType, ModuleDeclaration, ModuleExportName, ModuleKind, NewExpression, Node, NullLiteral, NumericLiteral, ObjectAssignmentTarget, ObjectExpression, ObjectPattern, ObjectProperty, ObjectPropertyKind, ParamPattern, ParenthesizedExpression, PrivateFieldExpression, PrivateIdentifier, PrivateInExpression, Program, PropertyDefinition, PropertyDefinitionType, PropertyKey, PropertyKind, RegExpLiteral, ReturnStatement, SequenceExpression, SimpleAssignmentTarget, Span$1 as Span, SpreadElement, Statement, StaticBlock, StaticMemberExpression, StringLiteral, Super, SwitchCase, SwitchStatement, TSAccessibility, TSAnyKeyword, TSArrayType, TSAsExpression, TSBigIntKeyword, TSBooleanKeyword, TSCallSignatureDeclaration, TSClassImplements, TSConditionalType, TSConstructSignatureDeclaration, TSConstructorType, TSEnumBody, TSEnumDeclaration, TSEnumMember, TSEnumMemberName, TSExportAssignment, TSExternalModuleReference, TSFunctionType, TSGlobalDeclaration, TSImportEqualsDeclaration, TSImportType, TSImportTypeQualifiedName, TSImportTypeQualifier, TSIndexSignature, TSIndexSignatureName, TSIndexedAccessType, TSInferType, TSInstantiationExpression, TSInterfaceBody, TSInterfaceDeclaration, TSInterfaceHeritage, TSIntersectionType, TSIntrinsicKeyword, TSLiteral, TSLiteralType, TSMappedType, TSMappedTypeModifierOperator, TSMethodSignature, TSMethodSignatureKind, TSModuleBlock, TSModuleDeclaration, TSModuleDeclarationKind, TSModuleReference, TSNamedTupleMember, TSNamespaceExportDeclaration, TSNeverKeyword, TSNonNullExpression, TSNullKeyword, TSNumberKeyword, TSObjectKeyword, TSOptionalType, TSParameterProperty, TSParenthesizedType, TSPropertySignature, TSQualifiedName, TSRestType, TSSatisfiesExpression, TSSignature, TSStringKeyword, TSSymbolKeyword, TSTemplateLiteralType, TSThisParameter, TSThisType, TSTupleElement, TSTupleType, TSType, TSTypeAliasDeclaration, TSTypeAnnotation, TSTypeAssertion, TSTypeLiteral, TSTypeName, TSTypeOperator, TSTypeOperatorOperator, TSTypeParameter, TSTypeParameterDeclaration, TSTypeParameterInstantiation, TSTypePredicate, TSTypePredicateName, TSTypeQuery, TSTypeQueryExprName, TSTypeReference, TSUndefinedKeyword, TSUnionType, TSUnknownKeyword, TSVoidKeyword, TaggedTemplateExpression, TemplateElement, TemplateElementValue, TemplateLiteral, ThisExpression, ThrowStatement, TryStatement, UnaryExpression, UnaryOperator, UpdateExpression, UpdateOperator, V8IntrinsicExpression, VariableDeclaration, VariableDeclarationKind, VariableDeclarator, WhileStatement, WithStatement, YieldExpression };
}
// Auto-generated code, DO NOT EDIT DIRECTLY!
// To edit this generated file you have to edit `tasks/ast_tools/src/generators/typescript.rs`.
interface Program extends Span$1 {
  type: "Program";
  body: Array<Directive | Statement>;
  sourceType: ModuleKind;
  hashbang: Hashbang | null;
  parent?: null;
}
type Expression = BooleanLiteral | NullLiteral | NumericLiteral | BigIntLiteral | RegExpLiteral | StringLiteral | TemplateLiteral | IdentifierReference | MetaProperty | Super | ArrayExpression | ArrowFunctionExpression | AssignmentExpression | AwaitExpression | BinaryExpression | CallExpression | ChainExpression | Class | ConditionalExpression | Function | ImportExpression | LogicalExpression | NewExpression | ObjectExpression | ParenthesizedExpression | SequenceExpression | TaggedTemplateExpression | ThisExpression | UnaryExpression | UpdateExpression | YieldExpression | PrivateInExpression | JSXElement | JSXFragment | TSAsExpression | TSSatisfiesExpression | TSTypeAssertion | TSNonNullExpression | TSInstantiationExpression | V8IntrinsicExpression | MemberExpression;
interface IdentifierName extends Span$1 {
  type: "Identifier";
  decorators?: [];
  name: string;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface IdentifierReference extends Span$1 {
  type: "Identifier";
  decorators?: [];
  name: string;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface BindingIdentifier extends Span$1 {
  type: "Identifier";
  decorators?: [];
  name: string;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface LabelIdentifier extends Span$1 {
  type: "Identifier";
  decorators?: [];
  name: string;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface ThisExpression extends Span$1 {
  type: "ThisExpression";
  parent?: Node;
}
interface ArrayExpression extends Span$1 {
  type: "ArrayExpression";
  elements: Array<ArrayExpressionElement>;
  parent?: Node;
}
type ArrayExpressionElement = SpreadElement | null | Expression;
interface ObjectExpression extends Span$1 {
  type: "ObjectExpression";
  properties: Array<ObjectPropertyKind>;
  parent?: Node;
}
type ObjectPropertyKind = ObjectProperty | SpreadElement;
interface ObjectProperty extends Span$1 {
  type: "Property";
  kind: PropertyKind;
  key: PropertyKey;
  value: Expression;
  method: boolean;
  shorthand: boolean;
  computed: boolean;
  optional?: false;
  parent?: Node;
}
type PropertyKey = IdentifierName | PrivateIdentifier | Expression;
type PropertyKind = "init" | "get" | "set";
interface TemplateLiteral extends Span$1 {
  type: "TemplateLiteral";
  quasis: Array<TemplateElement>;
  expressions: Array<Expression>;
  parent?: Node;
}
interface TaggedTemplateExpression extends Span$1 {
  type: "TaggedTemplateExpression";
  tag: Expression;
  typeArguments?: TSTypeParameterInstantiation | null;
  quasi: TemplateLiteral;
  parent?: Node;
}
interface TemplateElement extends Span$1 {
  type: "TemplateElement";
  value: TemplateElementValue;
  tail: boolean;
  parent?: Node;
}
interface TemplateElementValue {
  raw: string;
  cooked: string | null;
}
type MemberExpression = ComputedMemberExpression | StaticMemberExpression | PrivateFieldExpression;
interface ComputedMemberExpression extends Span$1 {
  type: "MemberExpression";
  object: Expression;
  property: Expression;
  optional: boolean;
  computed: true;
  parent?: Node;
}
interface StaticMemberExpression extends Span$1 {
  type: "MemberExpression";
  object: Expression;
  property: IdentifierName;
  optional: boolean;
  computed: false;
  parent?: Node;
}
interface PrivateFieldExpression extends Span$1 {
  type: "MemberExpression";
  object: Expression;
  property: PrivateIdentifier;
  optional: boolean;
  computed: false;
  parent?: Node;
}
interface CallExpression extends Span$1 {
  type: "CallExpression";
  callee: Expression;
  typeArguments?: TSTypeParameterInstantiation | null;
  arguments: Array<Argument>;
  optional: boolean;
  parent?: Node;
}
interface NewExpression extends Span$1 {
  type: "NewExpression";
  callee: Expression;
  typeArguments?: TSTypeParameterInstantiation | null;
  arguments: Array<Argument>;
  parent?: Node;
}
interface MetaProperty extends Span$1 {
  type: "MetaProperty";
  meta: IdentifierName;
  property: IdentifierName;
  parent?: Node;
}
interface SpreadElement extends Span$1 {
  type: "SpreadElement";
  argument: Expression;
  parent?: Node;
}
type Argument = SpreadElement | Expression;
interface UpdateExpression extends Span$1 {
  type: "UpdateExpression";
  operator: UpdateOperator;
  prefix: boolean;
  argument: SimpleAssignmentTarget;
  parent?: Node;
}
interface UnaryExpression extends Span$1 {
  type: "UnaryExpression";
  operator: UnaryOperator;
  argument: Expression;
  prefix: true;
  parent?: Node;
}
interface BinaryExpression extends Span$1 {
  type: "BinaryExpression";
  left: Expression;
  operator: BinaryOperator;
  right: Expression;
  parent?: Node;
}
interface PrivateInExpression extends Span$1 {
  type: "BinaryExpression";
  left: PrivateIdentifier;
  operator: "in";
  right: Expression;
  parent?: Node;
}
interface LogicalExpression extends Span$1 {
  type: "LogicalExpression";
  left: Expression;
  operator: LogicalOperator;
  right: Expression;
  parent?: Node;
}
interface ConditionalExpression extends Span$1 {
  type: "ConditionalExpression";
  test: Expression;
  consequent: Expression;
  alternate: Expression;
  parent?: Node;
}
interface AssignmentExpression extends Span$1 {
  type: "AssignmentExpression";
  operator: AssignmentOperator;
  left: AssignmentTarget;
  right: Expression;
  parent?: Node;
}
type AssignmentTarget = SimpleAssignmentTarget | AssignmentTargetPattern;
type SimpleAssignmentTarget = IdentifierReference | TSAsExpression | TSSatisfiesExpression | TSNonNullExpression | TSTypeAssertion | MemberExpression;
type AssignmentTargetPattern = ArrayAssignmentTarget | ObjectAssignmentTarget;
interface ArrayAssignmentTarget extends Span$1 {
  type: "ArrayPattern";
  decorators?: [];
  elements: Array<AssignmentTargetMaybeDefault | AssignmentTargetRest | null>;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface ObjectAssignmentTarget extends Span$1 {
  type: "ObjectPattern";
  decorators?: [];
  properties: Array<AssignmentTargetProperty | AssignmentTargetRest>;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface AssignmentTargetRest extends Span$1 {
  type: "RestElement";
  decorators?: [];
  argument: AssignmentTarget;
  optional?: false;
  typeAnnotation?: null;
  value?: null;
  parent?: Node;
}
type AssignmentTargetMaybeDefault = AssignmentTargetWithDefault | AssignmentTarget;
interface AssignmentTargetWithDefault extends Span$1 {
  type: "AssignmentPattern";
  decorators?: [];
  left: AssignmentTarget;
  right: Expression;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
type AssignmentTargetProperty = AssignmentTargetPropertyIdentifier | AssignmentTargetPropertyProperty;
interface AssignmentTargetPropertyIdentifier extends Span$1 {
  type: "Property";
  kind: "init";
  key: IdentifierReference;
  value: IdentifierReference | AssignmentTargetWithDefault;
  method: false;
  shorthand: true;
  computed: false;
  optional?: false;
  parent?: Node;
}
interface AssignmentTargetPropertyProperty extends Span$1 {
  type: "Property";
  kind: "init";
  key: PropertyKey;
  value: AssignmentTargetMaybeDefault;
  method: false;
  shorthand: false;
  computed: boolean;
  optional?: false;
  parent?: Node;
}
interface SequenceExpression extends Span$1 {
  type: "SequenceExpression";
  expressions: Array<Expression>;
  parent?: Node;
}
interface Super extends Span$1 {
  type: "Super";
  parent?: Node;
}
interface AwaitExpression extends Span$1 {
  type: "AwaitExpression";
  argument: Expression;
  parent?: Node;
}
interface ChainExpression extends Span$1 {
  type: "ChainExpression";
  expression: ChainElement;
  parent?: Node;
}
type ChainElement = CallExpression | TSNonNullExpression | MemberExpression;
interface ParenthesizedExpression extends Span$1 {
  type: "ParenthesizedExpression";
  expression: Expression;
  parent?: Node;
}
type Statement = BlockStatement | BreakStatement | ContinueStatement | DebuggerStatement | DoWhileStatement | EmptyStatement | ExpressionStatement | ForInStatement | ForOfStatement | ForStatement | IfStatement | LabeledStatement | ReturnStatement | SwitchStatement | ThrowStatement | TryStatement | WhileStatement | WithStatement | Declaration | ModuleDeclaration;
interface Directive extends Span$1 {
  type: "ExpressionStatement";
  expression: StringLiteral;
  directive: string;
  parent?: Node;
}
interface Hashbang extends Span$1 {
  type: "Hashbang";
  value: string;
  parent?: Node;
}
interface BlockStatement extends Span$1 {
  type: "BlockStatement";
  body: Array<Statement>;
  parent?: Node;
}
type Declaration = VariableDeclaration | Function | Class | TSTypeAliasDeclaration | TSInterfaceDeclaration | TSEnumDeclaration | TSModuleDeclaration | TSGlobalDeclaration | TSImportEqualsDeclaration;
interface VariableDeclaration extends Span$1 {
  type: "VariableDeclaration";
  kind: VariableDeclarationKind;
  declarations: Array<VariableDeclarator>;
  declare?: boolean;
  parent?: Node;
}
type VariableDeclarationKind = "var" | "let" | "const" | "using" | "await using";
interface VariableDeclarator extends Span$1 {
  type: "VariableDeclarator";
  id: BindingPattern;
  init: Expression | null;
  definite?: boolean;
  parent?: Node;
}
interface EmptyStatement extends Span$1 {
  type: "EmptyStatement";
  parent?: Node;
}
interface ExpressionStatement extends Span$1 {
  type: "ExpressionStatement";
  expression: Expression;
  directive?: string | null;
  parent?: Node;
}
interface IfStatement extends Span$1 {
  type: "IfStatement";
  test: Expression;
  consequent: Statement;
  alternate: Statement | null;
  parent?: Node;
}
interface DoWhileStatement extends Span$1 {
  type: "DoWhileStatement";
  body: Statement;
  test: Expression;
  parent?: Node;
}
interface WhileStatement extends Span$1 {
  type: "WhileStatement";
  test: Expression;
  body: Statement;
  parent?: Node;
}
interface ForStatement extends Span$1 {
  type: "ForStatement";
  init: ForStatementInit | null;
  test: Expression | null;
  update: Expression | null;
  body: Statement;
  parent?: Node;
}
type ForStatementInit = VariableDeclaration | Expression;
interface ForInStatement extends Span$1 {
  type: "ForInStatement";
  left: ForStatementLeft;
  right: Expression;
  body: Statement;
  parent?: Node;
}
type ForStatementLeft = VariableDeclaration | AssignmentTarget;
interface ForOfStatement extends Span$1 {
  type: "ForOfStatement";
  await: boolean;
  left: ForStatementLeft;
  right: Expression;
  body: Statement;
  parent?: Node;
}
interface ContinueStatement extends Span$1 {
  type: "ContinueStatement";
  label: LabelIdentifier | null;
  parent?: Node;
}
interface BreakStatement extends Span$1 {
  type: "BreakStatement";
  label: LabelIdentifier | null;
  parent?: Node;
}
interface ReturnStatement extends Span$1 {
  type: "ReturnStatement";
  argument: Expression | null;
  parent?: Node;
}
interface WithStatement extends Span$1 {
  type: "WithStatement";
  object: Expression;
  body: Statement;
  parent?: Node;
}
interface SwitchStatement extends Span$1 {
  type: "SwitchStatement";
  discriminant: Expression;
  cases: Array<SwitchCase>;
  parent?: Node;
}
interface SwitchCase extends Span$1 {
  type: "SwitchCase";
  test: Expression | null;
  consequent: Array<Statement>;
  parent?: Node;
}
interface LabeledStatement extends Span$1 {
  type: "LabeledStatement";
  label: LabelIdentifier;
  body: Statement;
  parent?: Node;
}
interface ThrowStatement extends Span$1 {
  type: "ThrowStatement";
  argument: Expression;
  parent?: Node;
}
interface TryStatement extends Span$1 {
  type: "TryStatement";
  block: BlockStatement;
  handler: CatchClause | null;
  finalizer: BlockStatement | null;
  parent?: Node;
}
interface CatchClause extends Span$1 {
  type: "CatchClause";
  param: BindingPattern | null;
  body: BlockStatement;
  parent?: Node;
}
interface DebuggerStatement extends Span$1 {
  type: "DebuggerStatement";
  parent?: Node;
}
type BindingPattern = BindingIdentifier | ObjectPattern | ArrayPattern | AssignmentPattern;
interface AssignmentPattern extends Span$1 {
  type: "AssignmentPattern";
  decorators?: [];
  left: BindingPattern;
  right: Expression;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface ObjectPattern extends Span$1 {
  type: "ObjectPattern";
  decorators?: [];
  properties: Array<BindingProperty | BindingRestElement>;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface BindingProperty extends Span$1 {
  type: "Property";
  kind: "init";
  key: PropertyKey;
  value: BindingPattern;
  method: false;
  shorthand: boolean;
  computed: boolean;
  optional?: false;
  parent?: Node;
}
interface ArrayPattern extends Span$1 {
  type: "ArrayPattern";
  decorators?: [];
  elements: Array<BindingPattern | BindingRestElement | null>;
  optional?: false;
  typeAnnotation?: null;
  parent?: Node;
}
interface BindingRestElement extends Span$1 {
  type: "RestElement";
  decorators?: [];
  argument: BindingPattern;
  optional?: false;
  typeAnnotation?: null;
  value?: null;
  parent?: Node;
}
interface Function extends Span$1 {
  type: FunctionType;
  id: BindingIdentifier | null;
  generator: boolean;
  async: boolean;
  declare?: boolean;
  typeParameters?: TSTypeParameterDeclaration | null;
  params: ParamPattern[];
  returnType?: TSTypeAnnotation | null;
  body: FunctionBody | null;
  expression: false;
  parent?: Node;
}
type ParamPattern = FormalParameter | TSParameterProperty | FormalParameterRest;
type FunctionType = "FunctionDeclaration" | "FunctionExpression" | "TSDeclareFunction" | "TSEmptyBodyFunctionExpression";
interface FormalParameterRest extends Span$1 {
  type: "RestElement";
  argument: BindingPattern;
  decorators?: [];
  optional?: boolean;
  typeAnnotation?: TSTypeAnnotation | null;
  value?: null;
  parent?: Node;
}
type FormalParameter = {
  decorators?: Array<Decorator>;
} & BindingPattern;
interface TSParameterProperty extends Span$1 {
  type: "TSParameterProperty";
  accessibility: TSAccessibility | null;
  decorators: Array<Decorator>;
  override: boolean;
  parameter: FormalParameter;
  readonly: boolean;
  static: boolean;
  parent?: Node;
}
interface FunctionBody extends Span$1 {
  type: "BlockStatement";
  body: Array<Directive | Statement>;
  parent?: Node;
}
interface ArrowFunctionExpression extends Span$1 {
  type: "ArrowFunctionExpression";
  expression: boolean;
  async: boolean;
  typeParameters?: TSTypeParameterDeclaration | null;
  params: ParamPattern[];
  returnType?: TSTypeAnnotation | null;
  body: FunctionBody | Expression;
  id: null;
  generator: false;
  parent?: Node;
}
interface YieldExpression extends Span$1 {
  type: "YieldExpression";
  delegate: boolean;
  argument: Expression | null;
  parent?: Node;
}
interface Class extends Span$1 {
  type: ClassType;
  decorators: Array<Decorator>;
  id: BindingIdentifier | null;
  typeParameters?: TSTypeParameterDeclaration | null;
  superClass: Expression | null;
  superTypeArguments?: TSTypeParameterInstantiation | null;
  implements?: Array<TSClassImplements>;
  body: ClassBody;
  abstract?: boolean;
  declare?: boolean;
  parent?: Node;
}
type ClassType = "ClassDeclaration" | "ClassExpression";
interface ClassBody extends Span$1 {
  type: "ClassBody";
  body: Array<ClassElement>;
  parent?: Node;
}
type ClassElement = StaticBlock | MethodDefinition | PropertyDefinition | AccessorProperty | TSIndexSignature;
interface MethodDefinition extends Span$1 {
  type: MethodDefinitionType;
  decorators: Array<Decorator>;
  key: PropertyKey;
  value: Function;
  kind: MethodDefinitionKind;
  computed: boolean;
  static: boolean;
  override?: boolean;
  optional?: boolean;
  accessibility?: TSAccessibility | null;
  parent?: Node;
}
type MethodDefinitionType = "MethodDefinition" | "TSAbstractMethodDefinition";
interface PropertyDefinition extends Span$1 {
  type: PropertyDefinitionType;
  decorators: Array<Decorator>;
  key: PropertyKey;
  typeAnnotation?: TSTypeAnnotation | null;
  value: Expression | null;
  computed: boolean;
  static: boolean;
  declare?: boolean;
  override?: boolean;
  optional?: boolean;
  definite?: boolean;
  readonly?: boolean;
  accessibility?: TSAccessibility | null;
  parent?: Node;
}
type PropertyDefinitionType = "PropertyDefinition" | "TSAbstractPropertyDefinition";
type MethodDefinitionKind = "constructor" | "method" | "get" | "set";
interface PrivateIdentifier extends Span$1 {
  type: "PrivateIdentifier";
  name: string;
  parent?: Node;
}
interface StaticBlock extends Span$1 {
  type: "StaticBlock";
  body: Array<Statement>;
  parent?: Node;
}
type ModuleDeclaration = ImportDeclaration | ExportAllDeclaration | ExportDefaultDeclaration | ExportNamedDeclaration | TSExportAssignment | TSNamespaceExportDeclaration;
type AccessorPropertyType = "AccessorProperty" | "TSAbstractAccessorProperty";
interface AccessorProperty extends Span$1 {
  type: AccessorPropertyType;
  decorators: Array<Decorator>;
  key: PropertyKey;
  typeAnnotation?: TSTypeAnnotation | null;
  value: Expression | null;
  computed: boolean;
  static: boolean;
  override?: boolean;
  definite?: boolean;
  accessibility?: TSAccessibility | null;
  declare?: false;
  optional?: false;
  readonly?: false;
  parent?: Node;
}
interface ImportExpression extends Span$1 {
  type: "ImportExpression";
  source: Expression;
  options: Expression | null;
  phase: ImportPhase | null;
  parent?: Node;
}
interface ImportDeclaration extends Span$1 {
  type: "ImportDeclaration";
  specifiers: Array<ImportDeclarationSpecifier>;
  source: StringLiteral;
  phase: ImportPhase | null;
  attributes: Array<ImportAttribute>;
  importKind?: ImportOrExportKind;
  parent?: Node;
}
type ImportPhase = "source" | "defer";
type ImportDeclarationSpecifier = ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier;
interface ImportSpecifier extends Span$1 {
  type: "ImportSpecifier";
  imported: ModuleExportName;
  local: BindingIdentifier;
  importKind?: ImportOrExportKind;
  parent?: Node;
}
interface ImportDefaultSpecifier extends Span$1 {
  type: "ImportDefaultSpecifier";
  local: BindingIdentifier;
  parent?: Node;
}
interface ImportNamespaceSpecifier extends Span$1 {
  type: "ImportNamespaceSpecifier";
  local: BindingIdentifier;
  parent?: Node;
}
interface ImportAttribute extends Span$1 {
  type: "ImportAttribute";
  key: ImportAttributeKey;
  value: StringLiteral;
  parent?: Node;
}
type ImportAttributeKey = IdentifierName | StringLiteral;
interface ExportNamedDeclaration extends Span$1 {
  type: "ExportNamedDeclaration";
  declaration: Declaration | null;
  specifiers: Array<ExportSpecifier>;
  source: StringLiteral | null;
  exportKind?: ImportOrExportKind;
  attributes: Array<ImportAttribute>;
  parent?: Node;
}
interface ExportDefaultDeclaration extends Span$1 {
  type: "ExportDefaultDeclaration";
  declaration: ExportDefaultDeclarationKind;
  exportKind?: "value";
  parent?: Node;
}
interface ExportAllDeclaration extends Span$1 {
  type: "ExportAllDeclaration";
  exported: ModuleExportName | null;
  source: StringLiteral;
  attributes: Array<ImportAttribute>;
  exportKind?: ImportOrExportKind;
  parent?: Node;
}
interface ExportSpecifier extends Span$1 {
  type: "ExportSpecifier";
  local: ModuleExportName;
  exported: ModuleExportName;
  exportKind?: ImportOrExportKind;
  parent?: Node;
}
type ExportDefaultDeclarationKind = Function | Class | TSInterfaceDeclaration | Expression;
type ModuleExportName = IdentifierName | IdentifierReference | StringLiteral;
interface V8IntrinsicExpression extends Span$1 {
  type: "V8IntrinsicExpression";
  name: IdentifierName;
  arguments: Array<Argument>;
  parent?: Node;
}
interface BooleanLiteral extends Span$1 {
  type: "Literal";
  value: boolean;
  raw: string | null;
  parent?: Node;
}
interface NullLiteral extends Span$1 {
  type: "Literal";
  value: null;
  raw: "null" | null;
  parent?: Node;
}
interface NumericLiteral extends Span$1 {
  type: "Literal";
  value: number;
  raw: string | null;
  parent?: Node;
}
interface StringLiteral extends Span$1 {
  type: "Literal";
  value: string;
  raw: string | null;
  parent?: Node;
}
interface BigIntLiteral extends Span$1 {
  type: "Literal";
  value: bigint;
  raw: string | null;
  bigint: string;
  parent?: Node;
}
interface RegExpLiteral extends Span$1 {
  type: "Literal";
  value: RegExp | null;
  raw: string | null;
  regex: {
    pattern: string;
    flags: string;
  };
  parent?: Node;
}
interface JSXElement extends Span$1 {
  type: "JSXElement";
  openingElement: JSXOpeningElement;
  children: Array<JSXChild>;
  closingElement: JSXClosingElement | null;
  parent?: Node;
}
interface JSXOpeningElement extends Span$1 {
  type: "JSXOpeningElement";
  name: JSXElementName;
  typeArguments?: TSTypeParameterInstantiation | null;
  attributes: Array<JSXAttributeItem>;
  selfClosing: boolean;
  parent?: Node;
}
interface JSXClosingElement extends Span$1 {
  type: "JSXClosingElement";
  name: JSXElementName;
  parent?: Node;
}
interface JSXFragment extends Span$1 {
  type: "JSXFragment";
  openingFragment: JSXOpeningFragment;
  children: Array<JSXChild>;
  closingFragment: JSXClosingFragment;
  parent?: Node;
}
interface JSXOpeningFragment extends Span$1 {
  type: "JSXOpeningFragment";
  attributes?: [];
  selfClosing?: false;
  parent?: Node;
}
interface JSXClosingFragment extends Span$1 {
  type: "JSXClosingFragment";
  parent?: Node;
}
type JSXElementName = JSXIdentifier | JSXNamespacedName | JSXMemberExpression;
interface JSXNamespacedName extends Span$1 {
  type: "JSXNamespacedName";
  namespace: JSXIdentifier;
  name: JSXIdentifier;
  parent?: Node;
}
interface JSXMemberExpression extends Span$1 {
  type: "JSXMemberExpression";
  object: JSXMemberExpressionObject;
  property: JSXIdentifier;
  parent?: Node;
}
type JSXMemberExpressionObject = JSXIdentifier | JSXMemberExpression;
interface JSXExpressionContainer extends Span$1 {
  type: "JSXExpressionContainer";
  expression: JSXExpression;
  parent?: Node;
}
type JSXExpression = JSXEmptyExpression | Expression;
interface JSXEmptyExpression extends Span$1 {
  type: "JSXEmptyExpression";
  parent?: Node;
}
type JSXAttributeItem = JSXAttribute | JSXSpreadAttribute;
interface JSXAttribute extends Span$1 {
  type: "JSXAttribute";
  name: JSXAttributeName;
  value: JSXAttributeValue | null;
  parent?: Node;
}
interface JSXSpreadAttribute extends Span$1 {
  type: "JSXSpreadAttribute";
  argument: Expression;
  parent?: Node;
}
type JSXAttributeName = JSXIdentifier | JSXNamespacedName;
type JSXAttributeValue = StringLiteral | JSXExpressionContainer | JSXElement | JSXFragment;
interface JSXIdentifier extends Span$1 {
  type: "JSXIdentifier";
  name: string;
  parent?: Node;
}
type JSXChild = JSXText | JSXElement | JSXFragment | JSXExpressionContainer | JSXSpreadChild;
interface JSXSpreadChild extends Span$1 {
  type: "JSXSpreadChild";
  expression: Expression;
  parent?: Node;
}
interface JSXText extends Span$1 {
  type: "JSXText";
  value: string;
  raw: string | null;
  parent?: Node;
}
interface TSThisParameter extends Span$1 {
  type: "Identifier";
  decorators: [];
  name: "this";
  optional: false;
  typeAnnotation: TSTypeAnnotation | null;
  parent?: Node;
}
interface TSEnumDeclaration extends Span$1 {
  type: "TSEnumDeclaration";
  id: BindingIdentifier;
  body: TSEnumBody;
  const: boolean;
  declare: boolean;
  parent?: Node;
}
interface TSEnumBody extends Span$1 {
  type: "TSEnumBody";
  members: Array<TSEnumMember>;
  parent?: Node;
}
interface TSEnumMember extends Span$1 {
  type: "TSEnumMember";
  id: TSEnumMemberName;
  initializer: Expression | null;
  computed: boolean;
  parent?: Node;
}
type TSEnumMemberName = IdentifierName | StringLiteral | TemplateLiteral;
interface TSTypeAnnotation extends Span$1 {
  type: "TSTypeAnnotation";
  typeAnnotation: TSType;
  parent?: Node;
}
interface TSLiteralType extends Span$1 {
  type: "TSLiteralType";
  literal: TSLiteral;
  parent?: Node;
}
type TSLiteral = BooleanLiteral | NumericLiteral | BigIntLiteral | StringLiteral | TemplateLiteral | UnaryExpression;
type TSType = TSAnyKeyword | TSBigIntKeyword | TSBooleanKeyword | TSIntrinsicKeyword | TSNeverKeyword | TSNullKeyword | TSNumberKeyword | TSObjectKeyword | TSStringKeyword | TSSymbolKeyword | TSUndefinedKeyword | TSUnknownKeyword | TSVoidKeyword | TSArrayType | TSConditionalType | TSConstructorType | TSFunctionType | TSImportType | TSIndexedAccessType | TSInferType | TSIntersectionType | TSLiteralType | TSMappedType | TSNamedTupleMember | TSTemplateLiteralType | TSThisType | TSTupleType | TSTypeLiteral | TSTypeOperator | TSTypePredicate | TSTypeQuery | TSTypeReference | TSUnionType | TSParenthesizedType | JSDocNullableType | JSDocNonNullableType | JSDocUnknownType;
interface TSConditionalType extends Span$1 {
  type: "TSConditionalType";
  checkType: TSType;
  extendsType: TSType;
  trueType: TSType;
  falseType: TSType;
  parent?: Node;
}
interface TSUnionType extends Span$1 {
  type: "TSUnionType";
  types: Array<TSType>;
  parent?: Node;
}
interface TSIntersectionType extends Span$1 {
  type: "TSIntersectionType";
  types: Array<TSType>;
  parent?: Node;
}
interface TSParenthesizedType extends Span$1 {
  type: "TSParenthesizedType";
  typeAnnotation: TSType;
  parent?: Node;
}
interface TSTypeOperator extends Span$1 {
  type: "TSTypeOperator";
  operator: TSTypeOperatorOperator;
  typeAnnotation: TSType;
  parent?: Node;
}
type TSTypeOperatorOperator = "keyof" | "unique" | "readonly";
interface TSArrayType extends Span$1 {
  type: "TSArrayType";
  elementType: TSType;
  parent?: Node;
}
interface TSIndexedAccessType extends Span$1 {
  type: "TSIndexedAccessType";
  objectType: TSType;
  indexType: TSType;
  parent?: Node;
}
interface TSTupleType extends Span$1 {
  type: "TSTupleType";
  elementTypes: Array<TSTupleElement>;
  parent?: Node;
}
interface TSNamedTupleMember extends Span$1 {
  type: "TSNamedTupleMember";
  label: IdentifierName;
  elementType: TSTupleElement;
  optional: boolean;
  parent?: Node;
}
interface TSOptionalType extends Span$1 {
  type: "TSOptionalType";
  typeAnnotation: TSType;
  parent?: Node;
}
interface TSRestType extends Span$1 {
  type: "TSRestType";
  typeAnnotation: TSType;
  parent?: Node;
}
type TSTupleElement = TSOptionalType | TSRestType | TSType;
interface TSAnyKeyword extends Span$1 {
  type: "TSAnyKeyword";
  parent?: Node;
}
interface TSStringKeyword extends Span$1 {
  type: "TSStringKeyword";
  parent?: Node;
}
interface TSBooleanKeyword extends Span$1 {
  type: "TSBooleanKeyword";
  parent?: Node;
}
interface TSNumberKeyword extends Span$1 {
  type: "TSNumberKeyword";
  parent?: Node;
}
interface TSNeverKeyword extends Span$1 {
  type: "TSNeverKeyword";
  parent?: Node;
}
interface TSIntrinsicKeyword extends Span$1 {
  type: "TSIntrinsicKeyword";
  parent?: Node;
}
interface TSUnknownKeyword extends Span$1 {
  type: "TSUnknownKeyword";
  parent?: Node;
}
interface TSNullKeyword extends Span$1 {
  type: "TSNullKeyword";
  parent?: Node;
}
interface TSUndefinedKeyword extends Span$1 {
  type: "TSUndefinedKeyword";
  parent?: Node;
}
interface TSVoidKeyword extends Span$1 {
  type: "TSVoidKeyword";
  parent?: Node;
}
interface TSSymbolKeyword extends Span$1 {
  type: "TSSymbolKeyword";
  parent?: Node;
}
interface TSThisType extends Span$1 {
  type: "TSThisType";
  parent?: Node;
}
interface TSObjectKeyword extends Span$1 {
  type: "TSObjectKeyword";
  parent?: Node;
}
interface TSBigIntKeyword extends Span$1 {
  type: "TSBigIntKeyword";
  parent?: Node;
}
interface TSTypeReference extends Span$1 {
  type: "TSTypeReference";
  typeName: TSTypeName;
  typeArguments: TSTypeParameterInstantiation | null;
  parent?: Node;
}
type TSTypeName = IdentifierReference | TSQualifiedName | ThisExpression;
interface TSQualifiedName extends Span$1 {
  type: "TSQualifiedName";
  left: TSTypeName;
  right: IdentifierName;
  parent?: Node;
}
interface TSTypeParameterInstantiation extends Span$1 {
  type: "TSTypeParameterInstantiation";
  params: Array<TSType>;
  parent?: Node;
}
interface TSTypeParameter extends Span$1 {
  type: "TSTypeParameter";
  name: BindingIdentifier;
  constraint: TSType | null;
  default: TSType | null;
  in: boolean;
  out: boolean;
  const: boolean;
  parent?: Node;
}
interface TSTypeParameterDeclaration extends Span$1 {
  type: "TSTypeParameterDeclaration";
  params: Array<TSTypeParameter>;
  parent?: Node;
}
interface TSTypeAliasDeclaration extends Span$1 {
  type: "TSTypeAliasDeclaration";
  id: BindingIdentifier;
  typeParameters: TSTypeParameterDeclaration | null;
  typeAnnotation: TSType;
  declare: boolean;
  parent?: Node;
}
type TSAccessibility = "private" | "protected" | "public";
interface TSClassImplements extends Span$1 {
  type: "TSClassImplements";
  expression: IdentifierReference | ThisExpression | MemberExpression;
  typeArguments: TSTypeParameterInstantiation | null;
  parent?: Node;
}
interface TSInterfaceDeclaration extends Span$1 {
  type: "TSInterfaceDeclaration";
  id: BindingIdentifier;
  typeParameters: TSTypeParameterDeclaration | null;
  extends: Array<TSInterfaceHeritage>;
  body: TSInterfaceBody;
  declare: boolean;
  parent?: Node;
}
interface TSInterfaceBody extends Span$1 {
  type: "TSInterfaceBody";
  body: Array<TSSignature>;
  parent?: Node;
}
interface TSPropertySignature extends Span$1 {
  type: "TSPropertySignature";
  computed: boolean;
  optional: boolean;
  readonly: boolean;
  key: PropertyKey;
  typeAnnotation: TSTypeAnnotation | null;
  accessibility: null;
  static: false;
  parent?: Node;
}
type TSSignature = TSIndexSignature | TSPropertySignature | TSCallSignatureDeclaration | TSConstructSignatureDeclaration | TSMethodSignature;
interface TSIndexSignature extends Span$1 {
  type: "TSIndexSignature";
  parameters: Array<TSIndexSignatureName>;
  typeAnnotation: TSTypeAnnotation;
  readonly: boolean;
  static: boolean;
  accessibility: null;
  parent?: Node;
}
interface TSCallSignatureDeclaration extends Span$1 {
  type: "TSCallSignatureDeclaration";
  typeParameters: TSTypeParameterDeclaration | null;
  params: ParamPattern[];
  returnType: TSTypeAnnotation | null;
  parent?: Node;
}
type TSMethodSignatureKind = "method" | "get" | "set";
interface TSMethodSignature extends Span$1 {
  type: "TSMethodSignature";
  key: PropertyKey;
  computed: boolean;
  optional: boolean;
  kind: TSMethodSignatureKind;
  typeParameters: TSTypeParameterDeclaration | null;
  params: ParamPattern[];
  returnType: TSTypeAnnotation | null;
  accessibility: null;
  readonly: false;
  static: false;
  parent?: Node;
}
interface TSConstructSignatureDeclaration extends Span$1 {
  type: "TSConstructSignatureDeclaration";
  typeParameters: TSTypeParameterDeclaration | null;
  params: ParamPattern[];
  returnType: TSTypeAnnotation | null;
  parent?: Node;
}
interface TSIndexSignatureName extends Span$1 {
  type: "Identifier";
  decorators: [];
  name: string;
  optional: false;
  typeAnnotation: TSTypeAnnotation;
  parent?: Node;
}
interface TSInterfaceHeritage extends Span$1 {
  type: "TSInterfaceHeritage";
  expression: Expression;
  typeArguments: TSTypeParameterInstantiation | null;
  parent?: Node;
}
interface TSTypePredicate extends Span$1 {
  type: "TSTypePredicate";
  parameterName: TSTypePredicateName;
  asserts: boolean;
  typeAnnotation: TSTypeAnnotation | null;
  parent?: Node;
}
type TSTypePredicateName = IdentifierName | TSThisType;
interface TSModuleDeclaration extends Span$1 {
  type: "TSModuleDeclaration";
  id: BindingIdentifier | StringLiteral | TSQualifiedName;
  body: TSModuleBlock | null;
  kind: TSModuleDeclarationKind;
  declare: boolean;
  global: false;
  parent?: Node;
}
type TSModuleDeclarationKind = "module" | "namespace";
interface TSGlobalDeclaration extends Span$1 {
  type: "TSModuleDeclaration";
  id: IdentifierName;
  body: TSModuleBlock;
  kind: "global";
  declare: boolean;
  global: true;
  parent?: Node;
}
interface TSModuleBlock extends Span$1 {
  type: "TSModuleBlock";
  body: Array<Directive | Statement>;
  parent?: Node;
}
interface TSTypeLiteral extends Span$1 {
  type: "TSTypeLiteral";
  members: Array<TSSignature>;
  parent?: Node;
}
interface TSInferType extends Span$1 {
  type: "TSInferType";
  typeParameter: TSTypeParameter;
  parent?: Node;
}
interface TSTypeQuery extends Span$1 {
  type: "TSTypeQuery";
  exprName: TSTypeQueryExprName;
  typeArguments: TSTypeParameterInstantiation | null;
  parent?: Node;
}
type TSTypeQueryExprName = TSImportType | TSTypeName;
interface TSImportType extends Span$1 {
  type: "TSImportType";
  source: StringLiteral;
  options: ObjectExpression | null;
  qualifier: TSImportTypeQualifier | null;
  typeArguments: TSTypeParameterInstantiation | null;
  parent?: Node;
}
type TSImportTypeQualifier = IdentifierName | TSImportTypeQualifiedName;
interface TSImportTypeQualifiedName extends Span$1 {
  type: "TSQualifiedName";
  left: TSImportTypeQualifier;
  right: IdentifierName;
  parent?: Node;
}
interface TSFunctionType extends Span$1 {
  type: "TSFunctionType";
  typeParameters: TSTypeParameterDeclaration | null;
  params: ParamPattern[];
  returnType: TSTypeAnnotation;
  parent?: Node;
}
interface TSConstructorType extends Span$1 {
  type: "TSConstructorType";
  abstract: boolean;
  typeParameters: TSTypeParameterDeclaration | null;
  params: ParamPattern[];
  returnType: TSTypeAnnotation;
  parent?: Node;
}
interface TSMappedType extends Span$1 {
  type: "TSMappedType";
  key: BindingIdentifier;
  constraint: TSType;
  nameType: TSType | null;
  typeAnnotation: TSType | null;
  optional: TSMappedTypeModifierOperator | false;
  readonly: TSMappedTypeModifierOperator | null;
  parent?: Node;
}
type TSMappedTypeModifierOperator = true | "+" | "-";
interface TSTemplateLiteralType extends Span$1 {
  type: "TSTemplateLiteralType";
  quasis: Array<TemplateElement>;
  types: Array<TSType>;
  parent?: Node;
}
interface TSAsExpression extends Span$1 {
  type: "TSAsExpression";
  expression: Expression;
  typeAnnotation: TSType;
  parent?: Node;
}
interface TSSatisfiesExpression extends Span$1 {
  type: "TSSatisfiesExpression";
  expression: Expression;
  typeAnnotation: TSType;
  parent?: Node;
}
interface TSTypeAssertion extends Span$1 {
  type: "TSTypeAssertion";
  typeAnnotation: TSType;
  expression: Expression;
  parent?: Node;
}
interface TSImportEqualsDeclaration extends Span$1 {
  type: "TSImportEqualsDeclaration";
  id: BindingIdentifier;
  moduleReference: TSModuleReference;
  importKind: ImportOrExportKind;
  parent?: Node;
}
type TSModuleReference = TSExternalModuleReference | IdentifierReference | TSQualifiedName;
interface TSExternalModuleReference extends Span$1 {
  type: "TSExternalModuleReference";
  expression: StringLiteral;
  parent?: Node;
}
interface TSNonNullExpression extends Span$1 {
  type: "TSNonNullExpression";
  expression: Expression;
  parent?: Node;
}
interface Decorator extends Span$1 {
  type: "Decorator";
  expression: Expression;
  parent?: Node;
}
interface TSExportAssignment extends Span$1 {
  type: "TSExportAssignment";
  expression: Expression;
  parent?: Node;
}
interface TSNamespaceExportDeclaration extends Span$1 {
  type: "TSNamespaceExportDeclaration";
  id: IdentifierName;
  parent?: Node;
}
interface TSInstantiationExpression extends Span$1 {
  type: "TSInstantiationExpression";
  expression: Expression;
  typeArguments: TSTypeParameterInstantiation;
  parent?: Node;
}
type ImportOrExportKind = "value" | "type";
interface JSDocNullableType extends Span$1 {
  type: "TSJSDocNullableType";
  typeAnnotation: TSType;
  postfix: boolean;
  parent?: Node;
}
interface JSDocNonNullableType extends Span$1 {
  type: "TSJSDocNonNullableType";
  typeAnnotation: TSType;
  postfix: boolean;
  parent?: Node;
}
interface JSDocUnknownType extends Span$1 {
  type: "TSJSDocUnknownType";
  parent?: Node;
}
type ModuleKind = "script" | "module" | "commonjs";
interface Span$1 {
  start: number;
  end: number;
  range?: [number, number];
}
type AssignmentOperator = "=" | "+=" | "-=" | "*=" | "/=" | "%=" | "**=" | "<<=" | ">>=" | ">>>=" | "|=" | "^=" | "&=" | "||=" | "&&=" | "??=";
type BinaryOperator = "==" | "!=" | "===" | "!==" | "<" | "<=" | ">" | ">=" | "+" | "-" | "*" | "/" | "%" | "**" | "<<" | ">>" | ">>>" | "|" | "^" | "&" | "in" | "instanceof";
type LogicalOperator = "||" | "&&" | "??";
type UnaryOperator = "+" | "-" | "!" | "~" | "typeof" | "void" | "delete";
type UpdateOperator = "++" | "--";
type Node = Program | IdentifierName | IdentifierReference | BindingIdentifier | LabelIdentifier | ThisExpression | ArrayExpression | ObjectExpression | ObjectProperty | TemplateLiteral | TaggedTemplateExpression | TemplateElement | ComputedMemberExpression | StaticMemberExpression | PrivateFieldExpression | CallExpression | NewExpression | MetaProperty | SpreadElement | UpdateExpression | UnaryExpression | BinaryExpression | PrivateInExpression | LogicalExpression | ConditionalExpression | AssignmentExpression | ArrayAssignmentTarget | ObjectAssignmentTarget | AssignmentTargetRest | AssignmentTargetWithDefault | AssignmentTargetPropertyIdentifier | AssignmentTargetPropertyProperty | SequenceExpression | Super | AwaitExpression | ChainExpression | ParenthesizedExpression | Directive | Hashbang | BlockStatement | VariableDeclaration | VariableDeclarator | EmptyStatement | ExpressionStatement | IfStatement | DoWhileStatement | WhileStatement | ForStatement | ForInStatement | ForOfStatement | ContinueStatement | BreakStatement | ReturnStatement | WithStatement | SwitchStatement | SwitchCase | LabeledStatement | ThrowStatement | TryStatement | CatchClause | DebuggerStatement | AssignmentPattern | ObjectPattern | BindingProperty | ArrayPattern | BindingRestElement | Function | FunctionBody | ArrowFunctionExpression | YieldExpression | Class | ClassBody | MethodDefinition | PropertyDefinition | PrivateIdentifier | StaticBlock | AccessorProperty | ImportExpression | ImportDeclaration | ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier | ImportAttribute | ExportNamedDeclaration | ExportDefaultDeclaration | ExportAllDeclaration | ExportSpecifier | V8IntrinsicExpression | BooleanLiteral | NullLiteral | NumericLiteral | StringLiteral | BigIntLiteral | RegExpLiteral | JSXElement | JSXOpeningElement | JSXClosingElement | JSXFragment | JSXOpeningFragment | JSXClosingFragment | JSXNamespacedName | JSXMemberExpression | JSXExpressionContainer | JSXEmptyExpression | JSXAttribute | JSXSpreadAttribute | JSXIdentifier | JSXSpreadChild | JSXText | TSThisParameter | TSEnumDeclaration | TSEnumBody | TSEnumMember | TSTypeAnnotation | TSLiteralType | TSConditionalType | TSUnionType | TSIntersectionType | TSParenthesizedType | TSTypeOperator | TSArrayType | TSIndexedAccessType | TSTupleType | TSNamedTupleMember | TSOptionalType | TSRestType | TSAnyKeyword | TSStringKeyword | TSBooleanKeyword | TSNumberKeyword | TSNeverKeyword | TSIntrinsicKeyword | TSUnknownKeyword | TSNullKeyword | TSUndefinedKeyword | TSVoidKeyword | TSSymbolKeyword | TSThisType | TSObjectKeyword | TSBigIntKeyword | TSTypeReference | TSQualifiedName | TSTypeParameterInstantiation | TSTypeParameter | TSTypeParameterDeclaration | TSTypeAliasDeclaration | TSClassImplements | TSInterfaceDeclaration | TSInterfaceBody | TSPropertySignature | TSIndexSignature | TSCallSignatureDeclaration | TSMethodSignature | TSConstructSignatureDeclaration | TSIndexSignatureName | TSInterfaceHeritage | TSTypePredicate | TSModuleDeclaration | TSGlobalDeclaration | TSModuleBlock | TSTypeLiteral | TSInferType | TSTypeQuery | TSImportType | TSImportTypeQualifiedName | TSFunctionType | TSConstructorType | TSMappedType | TSTemplateLiteralType | TSAsExpression | TSSatisfiesExpression | TSTypeAssertion | TSImportEqualsDeclaration | TSExternalModuleReference | TSNonNullExpression | Decorator | TSExportAssignment | TSNamespaceExportDeclaration | TSInstantiationExpression | JSDocNullableType | JSDocNonNullableType | JSDocUnknownType | ParamPattern;
//#endregion
//#region src/binding.d.cts
type MaybePromise<T> = T | Promise<T>;
type VoidNullable<T = void> = T | null | undefined | void;
type BindingStringOrRegex = string | RegExp;
interface CodegenOptions {
  /**
   * Remove whitespace.
   *
   * @default true
   */
  removeWhitespace?: boolean;
  /**
   * How to handle legal comments (comments containing `@license`, `@preserve`, or starting with `//!`/`/*!`).
   *
   * * `"none"` - Do not preserve any legal comments.
   * * `"inline"` - Preserve all legal comments inline.
   * * `"eof"` - Move all legal comments to the end of the file.
   * * `"external"` - Extract legal comments without linking.
   * * `{ linked: "path/to/legal.txt" }` - Extract legal comments and add a link comment to the given path.
   *
   * @default "none" (when minifying)
   */
  legalComments?: 'none' | 'inline' | 'eof' | 'external' | {
    linked: string;
  };
}
interface CompressOptions {
  /**
   * Set desired EcmaScript standard version for output.
   *
   * Set `esnext` to enable all target highering.
   *
   * Example:
   *
   * * `'es2015'`
   * * `['es2020', 'chrome58', 'edge16', 'firefox57', 'node12', 'safari11']`
   *
   * @default 'esnext'
   *
   * @see [esbuild#target](https://esbuild.github.io/api/#target)
   */
  target?: string | Array<string>;
  /**
   * Pass true to discard calls to `console.*`.
   *
   * @default false
   */
  dropConsole?: boolean;
  /**
   * Remove `debugger;` statements.
   *
   * @default true
   */
  dropDebugger?: boolean;
  /**
   * Pass `true` to drop unreferenced functions and variables.
   *
   * Simple direct variable assignments do not count as references unless set to `keep_assign`.
   * @default true
   */
  unused?: boolean | 'keep_assign';
  /** Keep function / class names. */
  keepNames?: CompressOptionsKeepNames;
  /**
   * Join consecutive var, let and const statements.
   *
   * @default true
   */
  joinVars?: boolean;
  /**
   * Join consecutive simple statements using the comma operator.
   *
   * `a; b` -> `a, b`
   *
   * @default true
   */
  sequences?: boolean;
  /**
   * Set of label names to drop from the code.
   *
   * Labeled statements matching these names will be removed during minification.
   *
   * @default []
   */
  dropLabels?: Array<string>;
  /** Limit the maximum number of iterations for debugging purpose. */
  maxIterations?: number;
  /** Treeshake options. */
  treeshake?: TreeShakeOptions;
}
interface CompressOptionsKeepNames {
  /**
   * Keep function names so that `Function.prototype.name` is preserved.
   *
   * This does not guarantee that the `undefined` name is preserved.
   *
   * @default false
   */
  function: boolean;
  /**
   * Keep class names so that `Class.prototype.name` is preserved.
   *
   * This does not guarantee that the `undefined` name is preserved.
   *
   * @default false
   */
  class: boolean;
}
interface MangleOptions {
  /**
   * Pass `true` to mangle names declared in the top level scope.
   *
   * @default true for modules and commonjs, otherwise false
   */
  toplevel?: boolean;
  /**
   * Preserve `name` property for functions and classes.
   *
   * @default false
   */
  keepNames?: boolean | MangleOptionsKeepNames;
  /** Debug mangled names. */
  debug?: boolean;
}
interface MangleOptionsKeepNames {
  /**
   * Preserve `name` property for functions.
   *
   * @default false
   */
  function: boolean;
  /**
   * Preserve `name` property for classes.
   *
   * @default false
   */
  class: boolean;
}
interface MinifyOptions {
  /** Use when minifying an ES module. */
  module?: boolean;
  compress?: boolean | CompressOptions;
  mangle?: boolean | MangleOptions;
  codegen?: boolean | CodegenOptions;
  sourcemap?: boolean;
}
interface MinifyResult {
  code: string;
  map?: SourceMap;
  errors: Array<OxcError>;
  /**
   * Legal comments extracted from the source code.
   * Only populated when `codegen.legalComments` is `"linked"` or `"external"`.
   */
  legalComments: Array<string>;
}
interface TreeShakeOptions {
  /**
   * Whether to respect the pure annotations.
   *
   * Pure annotations are comments that mark an expression as pure.
   * For example: @__PURE__ or #__NO_SIDE_EFFECTS__.
   *
   * @default true
   */
  annotations?: boolean;
  /**
   * Whether to treat this function call as pure.
   *
   * This function is called for normal function calls, new calls, and
   * tagged template calls.
   */
  manualPureFunctions?: Array<string>;
  /**
   * Whether property read accesses have side effects.
   *
   * @default 'always'
   */
  propertyReadSideEffects?: boolean | 'always';
  /**
   * Whether property write accesses (assignments to member expressions) have side effects.
   *
   * When false, assignments like `obj.prop = value` are considered side-effect-free
   * (assuming the object and value expressions themselves are side-effect-free).
   *
   * @default true
   */
  propertyWriteSideEffects?: boolean;
  /**
   * Whether accessing a global variable has side effects.
   *
   * Accessing a non-existing global variable will throw an error.
   * Global variable may be a getter that has side effects.
   *
   * @default true
   */
  unknownGlobalSideEffects?: boolean;
  /**
   * Whether invalid import statements have side effects.
   *
   * Accessing a non-existing import name will throw an error.
   * Also import statements that cannot be resolved will throw an error.
   *
   * @default true
   */
  invalidImportSideEffects?: boolean;
}
interface Comment {
  type: 'Line' | 'Block';
  value: string;
  start: number;
  end: number;
}
interface ErrorLabel {
  message: string | null;
  start: number;
  end: number;
}
interface OxcError {
  severity: Severity;
  message: string;
  labels: Array<ErrorLabel>;
  helpMessage: string | null;
  codeframe: string | null;
}
type Severity = 'Error' | 'Warning' | 'Advice';
declare class ParseResult {
  get program(): Program;
  get module(): EcmaScriptModule;
  get comments(): Array<Comment>;
  get errors(): Array<OxcError>;
}
interface DynamicImport {
  start: number;
  end: number;
  moduleRequest: Span;
}
interface EcmaScriptModule {
  /**
   * Has ESM syntax.
   *
   * i.e. `import` and `export` statements, and `import.meta`.
   *
   * Dynamic imports `import('foo')` are ignored since they can be used in non-ESM files.
   */
  hasModuleSyntax: boolean;
  /** Import statements. */
  staticImports: Array<StaticImport>;
  /** Export statements. */
  staticExports: Array<StaticExport>;
  /** Dynamic import expressions. */
  dynamicImports: Array<DynamicImport>;
  /** Span positions` of `import.meta` */
  importMetas: Array<Span>;
}
interface ExportExportName {
  kind: ExportExportNameKind;
  name: string | null;
  start: number | null;
  end: number | null;
}
type ExportExportNameKind = /** `export { name } */'Name' | /** `export default expression` */'Default' | /** `export * from "mod" */'None';
interface ExportImportName {
  kind: ExportImportNameKind;
  name: string | null;
  start: number | null;
  end: number | null;
}
type ExportImportNameKind = /** `export { name } */'Name' | /** `export * as ns from "mod"` */'All' | /** `export * from "mod"` */'AllButDefault' | /** Does not have a specifier. */'None';
interface ExportLocalName {
  kind: ExportLocalNameKind;
  name: string | null;
  start: number | null;
  end: number | null;
}
type ExportLocalNameKind = /** `export { name } */'Name' | /** `export default expression` */'Default' |
/**
 * If the exported value is not locally accessible from within the module.
 * `export default function () {}`
 */
'None';
interface ImportName {
  kind: ImportNameKind;
  name: string | null;
  start: number | null;
  end: number | null;
}
type ImportNameKind = /** `import { x } from "mod"` */'Name' | /** `import * as ns from "mod"` */'NamespaceObject' | /** `import defaultExport from "mod"` */'Default';
interface ParserOptions {
  /** Treat the source text as `js`, `jsx`, `ts`, `tsx` or `dts`. */
  lang?: 'js' | 'jsx' | 'ts' | 'tsx' | 'dts';
  /** Treat the source text as `script` or `module` code. */
  sourceType?: 'script' | 'module' | 'commonjs' | 'unambiguous' | undefined;
  /**
   * Return an AST which includes TypeScript-related properties, or excludes them.
   *
   * `'js'` is default for JS / JSX files.
   * `'ts'` is default for TS / TSX files.
   * The type of the file is determined from `lang` option, or extension of provided `filename`.
   */
  astType?: 'js' | 'ts';
  /**
   * Controls whether the `range` property is included on AST nodes.
   * The `range` property is a `[number, number]` which indicates the start/end offsets
   * of the node in the file contents.
   *
   * @default false
   */
  range?: boolean;
  /**
   * Emit `ParenthesizedExpression` and `TSParenthesizedType` in AST.
   *
   * If this option is true, parenthesized expressions are represented by
   * (non-standard) `ParenthesizedExpression` and `TSParenthesizedType` nodes that
   * have a single `expression` property containing the expression inside parentheses.
   *
   * @default true
   */
  preserveParens?: boolean;
  /**
   * Produce semantic errors with an additional AST pass.
   * Semantic errors depend on symbols and scopes, where the parser does not construct.
   * This adds a small performance overhead.
   *
   * @default false
   */
  showSemanticErrors?: boolean;
}
interface Span {
  start: number;
  end: number;
}
interface StaticExport {
  start: number;
  end: number;
  entries: Array<StaticExportEntry>;
}
interface StaticExportEntry {
  start: number;
  end: number;
  moduleRequest: ValueSpan | null;
  /** The name under which the desired binding is exported by the module`. */
  importName: ExportImportName;
  /** The name used to export this binding by this module. */
  exportName: ExportExportName;
  /** The name that is used to locally access the exported value from within the importing module. */
  localName: ExportLocalName;
  /**
   * Whether the export is a TypeScript `export type`.
   *
   * Examples:
   *
   * ```ts
   * export type * from 'mod';
   * export type * as ns from 'mod';
   * export type { foo };
   * export { type foo }:
   * export type { foo } from 'mod';
   * ```
   */
  isType: boolean;
}
interface StaticImport {
  /** Start of import statement. */
  start: number;
  /** End of import statement. */
  end: number;
  /**
   * Import source.
   *
   * ```js
   * import { foo } from "mod";
   * //                   ^^^
   * ```
   */
  moduleRequest: ValueSpan;
  /**
   * Import specifiers.
   *
   * Empty for `import "mod"`.
   */
  entries: Array<StaticImportEntry>;
}
interface StaticImportEntry {
  /**
   * The name under which the desired binding is exported by the module.
   *
   * ```js
   * import { foo } from "mod";
   * //       ^^^
   * import { foo as bar } from "mod";
   * //       ^^^
   * ```
   */
  importName: ImportName;
  /**
   * The name that is used to locally access the imported value from within the importing module.
   * ```js
   * import { foo } from "mod";
   * //       ^^^
   * import { foo as bar } from "mod";
   * //              ^^^
   * ```
   */
  localName: ValueSpan;
  /**
   * Whether this binding is for a TypeScript type-only import.
   *
   * `true` for the following imports:
   * ```ts
   * import type { foo } from "mod";
   * import { type foo } from "mod";
   * ```
   */
  isType: boolean;
}
interface ValueSpan {
  value: string;
  start: number;
  end: number;
}
declare class ResolverFactory {
  constructor(options?: NapiResolveOptions | undefined | null);
  static default(): ResolverFactory;
  /** Clone the resolver using the same underlying cache. */
  cloneWithOptions(options: NapiResolveOptions): ResolverFactory;
  /**
   * Clear the underlying cache.
   *
   * Warning: The caller must ensure that there're no ongoing resolution operations when calling this method. Otherwise, it may cause those operations to return an incorrect result.
   */
  clearCache(): void;
  /** Synchronously resolve `specifier` at an absolute path to a `directory`. */
  sync(directory: string, request: string): ResolveResult;
  /** Asynchronously resolve `specifier` at an absolute path to a `directory`. */
  async(directory: string, request: string): Promise<ResolveResult>;
  /**
   * Synchronously resolve `specifier` at an absolute path to a `file`.
   *
   * This method automatically discovers tsconfig.json by traversing parent directories.
   */
  resolveFileSync(file: string, request: string): ResolveResult;
  /**
   * Asynchronously resolve `specifier` at an absolute path to a `file`.
   *
   * This method automatically discovers tsconfig.json by traversing parent directories.
   */
  resolveFileAsync(file: string, request: string): Promise<ResolveResult>;
  /**
   * Synchronously resolve `specifier` for TypeScript declaration files.
   *
   * `file` is the absolute path to the containing file.
   * Uses TypeScript's `moduleResolution: "bundler"` algorithm.
   */
  resolveDtsSync(file: string, request: string): ResolveResult;
  /**
   * Asynchronously resolve `specifier` for TypeScript declaration files.
   *
   * `file` is the absolute path to the containing file.
   * Uses TypeScript's `moduleResolution: "bundler"` algorithm.
   */
  resolveDtsAsync(file: string, request: string): Promise<ResolveResult>;
}
/** Node.js builtin module when `Options::builtin_modules` is enabled. */
interface Builtin {
  /**
   * Resolved module.
   *
   * Always prefixed with "node:" in compliance with the ESM specification.
   */
  resolved: string;
  /**
   * Whether the request was prefixed with `node:` or not.
   * `fs` -> `false`.
   * `node:fs` returns `true`.
   */
  isRuntimeModule: boolean;
}
declare enum EnforceExtension {
  Auto = 0,
  Enabled = 1,
  Disabled = 2
}
type ModuleType = 'module' | 'commonjs' | 'json' | 'wasm' | 'addon';
/**
 * Module Resolution Options
 *
 * Options are directly ported from [enhanced-resolve](https://github.com/webpack/enhanced-resolve#resolver-options).
 *
 * See [webpack resolve](https://webpack.js.org/configuration/resolve/) for information and examples
 */
interface NapiResolveOptions {
  /**
   * Discover tsconfig automatically or use the specified tsconfig.json path.
   *
   * Default `None`
   */
  tsconfig?: 'auto' | TsconfigOptions;
  /**
   * Alias for [ResolveOptions::alias] and [ResolveOptions::fallback].
   *
   * For the second value of the tuple, `None -> AliasValue::Ignore`, Some(String) ->
   * AliasValue::Path(String)`
   * Create aliases to import or require certain modules more easily.
   * A trailing $ can also be added to the given object's keys to signify an exact match.
   * Default `{}`
   */
  alias?: Record<string, Array<string | undefined | null>>;
  /**
   * A list of alias fields in description files.
   * Specify a field, such as `browser`, to be parsed according to [this specification](https://github.com/defunctzombie/package-browser-field-spec).
   * Can be a path to json object such as `["path", "to", "exports"]`.
   *
   * Default `[]`
   */
  aliasFields?: (string | string[])[];
  /**
   * Condition names for exports field which defines entry points of a package.
   * The key order in the exports field is significant. During condition matching, earlier entries have higher priority and take precedence over later entries.
   *
   * Default `[]`
   */
  conditionNames?: Array<string>;
  /**
   * If true, it will not allow extension-less files.
   * So by default `require('./foo')` works if `./foo` has a `.js` extension,
   * but with this enabled only `require('./foo.js')` will work.
   *
   * Default to `true` when [ResolveOptions::extensions] contains an empty string.
   * Use `Some(false)` to disable the behavior.
   * See <https://github.com/webpack/enhanced-resolve/pull/285>
   *
   * Default None, which is the same as `Some(false)` when the above empty rule is not applied.
   */
  enforceExtension?: EnforceExtension;
  /**
   * A list of exports fields in description files.
   * Can be a path to json object such as `["path", "to", "exports"]`.
   *
   * Default `[["exports"]]`.
   */
  exportsFields?: (string | string[])[];
  /**
   * Fields from `package.json` which are used to provide the internal requests of a package
   * (requests starting with # are considered internal).
   *
   * Can be a path to a JSON object such as `["path", "to", "imports"]`.
   *
   * Default `[["imports"]]`.
   */
  importsFields?: (string | string[])[];
  /**
   * An object which maps extension to extension aliases.
   *
   * Default `{}`
   */
  extensionAlias?: Record<string, Array<string>>;
  /**
   * Attempt to resolve these extensions in order.
   * If multiple files share the same name but have different extensions,
   * will resolve the one with the extension listed first in the array and skip the rest.
   *
   * Default `[".js", ".json", ".node"]`
   */
  extensions?: Array<string>;
  /**
   * Redirect module requests when normal resolving fails.
   *
   * Default `{}`
   */
  fallback?: Record<string, Array<string | undefined | null>>;
  /**
   * Request passed to resolve is already fully specified and extensions or main files are not resolved for it (they are still resolved for internal requests).
   *
   * See also webpack configuration [resolve.fullySpecified](https://webpack.js.org/configuration/module/#resolvefullyspecified)
   *
   * Default `false`
   */
  fullySpecified?: boolean;
  /**
   * A list of main fields in description files
   *
   * Default `["main"]`.
   */
  mainFields?: string | string[];
  /**
   * The filename to be used while resolving directories.
   *
   * Default `["index"]`
   */
  mainFiles?: Array<string>;
  /**
   * A list of directories to resolve modules from, can be absolute path or folder name.
   *
   * Default `["node_modules"]`
   */
  modules?: string | string[];
  /**
   * Resolve to a context instead of a file.
   *
   * Default `false`
   */
  resolveToContext?: boolean;
  /**
   * Prefer to resolve module requests as relative requests instead of using modules from node_modules directories.
   *
   * Default `false`
   */
  preferRelative?: boolean;
  /**
   * Prefer to resolve server-relative urls as absolute paths before falling back to resolve in ResolveOptions::roots.
   *
   * Default `false`
   */
  preferAbsolute?: boolean;
  /**
   * A list of resolve restrictions to restrict the paths that a request can be resolved on.
   *
   * Default `[]`
   */
  restrictions?: Array<Restriction>;
  /**
   * A list of directories where requests of server-relative URLs (starting with '/') are resolved.
   * On non-Windows systems these requests are resolved as an absolute path first.
   *
   * Default `[]`
   */
  roots?: Array<string>;
  /**
   * Whether to resolve symlinks to their symlinked location.
   * When enabled, symlinked resources are resolved to their real path, not their symlinked location.
   * Note that this may cause module resolution to fail when using tools that symlink packages (like npm link).
   *
   * Default `true`
   */
  symlinks?: boolean;
  /**
   * Whether to read the `NODE_PATH` environment variable and append its entries to `modules`.
   *
   * `NODE_PATH` is a deprecated Node.js feature that is not part of ESM resolution.
   * Set this to `false` to disable the behavior.
   *
   * Default `true`
   */
  nodePath?: boolean;
  /**
   * Whether to parse [module.builtinModules](https://nodejs.org/api/module.html#modulebuiltinmodules) or not.
   * For example, "zlib" will throw [crate::ResolveError::Builtin] when set to true.
   *
   * Default `false`
   */
  builtinModules?: boolean;
  /**
   * Resolve [ResolveResult::moduleType].
   *
   * Default `false`
   */
  moduleType?: boolean;
  /**
   * Allow `exports` field in `require('../directory')`.
   *
   * This is not part of the spec but some vite projects rely on this behavior.
   * See
   * * <https://github.com/vitejs/vite/pull/20252>
   * * <https://github.com/nodejs/node/issues/58827>
   *
   * Default: `false`
   */
  allowPackageExportsInDirectoryResolve?: boolean;
}
interface ResolveResult {
  path?: string;
  error?: string;
  builtin?: Builtin;
  /**
   * Module type for this path.
   *
   * Enable with `ResolveOptions#moduleType`.
   *
   * The module type is computed `ESM_FILE_FORMAT` from the [ESM resolution algorithm specification](https://nodejs.org/docs/latest/api/esm.html#resolution-algorithm-specification).
   *
   *  The algorithm uses the file extension or finds the closest `package.json` with the `type` field.
   */
  moduleType?: ModuleType;
  /** `package.json` path for the given module. */
  packageJsonPath?: string;
}
/**
 * Alias Value for [ResolveOptions::alias] and [ResolveOptions::fallback].
 * Use struct because napi don't support structured union now
 */
interface Restriction {
  path?: string;
  regex?: string;
}
/**
 * Tsconfig Options
 *
 * Derived from [tsconfig-paths-webpack-plugin](https://github.com/dividab/tsconfig-paths-webpack-plugin#options)
 */
interface TsconfigOptions {
  /**
   * Allows you to specify where to find the TypeScript configuration file.
   * You may provide
   * * a relative path to the configuration file. It will be resolved relative to cwd.
   * * an absolute path to the configuration file.
   */
  configFile: string;
  /**
   * Support for Typescript Project References.
   *
   * * `'auto'`: use the `references` field from tsconfig of `config_file`.
   */
  references?: 'auto';
}
interface SourceMap {
  file?: string;
  mappings: string;
  names: Array<string>;
  sourceRoot?: string;
  sources: Array<string>;
  sourcesContent?: Array<string>;
  version: number;
  x_google_ignoreList?: Array<number>;
}
interface CompilerAssumptions {
  ignoreFunctionLength?: boolean;
  noDocumentAll?: boolean;
  objectRestNoSymbols?: boolean;
  pureGetters?: boolean;
  /**
   * When using public class fields, assume that they don't shadow any getter in the current class,
   * in its subclasses or in its superclass. Thus, it's safe to assign them rather than using
   * `Object.defineProperty`.
   *
   * For example:
   *
   * Input:
   * ```js
   * class Test {
   *  field = 2;
   *
   *  static staticField = 3;
   * }
   * ```
   *
   * When `set_public_class_fields` is `true`, the output will be:
   * ```js
   * class Test {
   *  constructor() {
   *    this.field = 2;
   *  }
   * }
   * Test.staticField = 3;
   * ```
   *
   * Otherwise, the output will be:
   * ```js
   * import _defineProperty from "@oxc-project/runtime/helpers/defineProperty";
   * class Test {
   *   constructor() {
   *     _defineProperty(this, "field", 2);
   *   }
   * }
   * _defineProperty(Test, "staticField", 3);
   * ```
   *
   * NOTE: For TypeScript, if you wanted behavior is equivalent to `useDefineForClassFields: false`, you should
   * set both `set_public_class_fields` and [`crate::TypeScriptOptions::remove_class_fields_without_initializer`]
   * to `true`.
   */
  setPublicClassFields?: boolean;
}
interface DecoratorOptions {
  /**
   * Enables experimental support for decorators, which is a version of decorators that predates the TC39 standardization process.
   *
   * Decorators are a language feature which hasn’t yet been fully ratified into the JavaScript specification.
   * This means that the implementation version in TypeScript may differ from the implementation in JavaScript when it it decided by TC39.
   *
   * @see https://www.typescriptlang.org/tsconfig/#experimentalDecorators
   * @default false
   */
  legacy?: boolean;
  /**
   * Enables emitting decorator metadata.
   *
   * This option the same as [emitDecoratorMetadata](https://www.typescriptlang.org/tsconfig/#emitDecoratorMetadata)
   * in TypeScript, and it only works when `legacy` is true.
   *
   * @see https://www.typescriptlang.org/tsconfig/#emitDecoratorMetadata
   * @default false
   */
  emitDecoratorMetadata?: boolean;
  /**
   * Aligns nullable-union `design:type` emission with `--strictNullChecks`.
   *
   * When `true` (default), `T | null` and `T | undefined` emit `Object`, matching tsc strict.
   * When `false`, `null` and `undefined` are elided from the union so the underlying
   * primitive constructor is emitted, matching tsc with `--strictNullChecks=false`
   * and `babel-plugin-transform-typescript-metadata`.
   *
   * @see https://www.typescriptlang.org/tsconfig/#strictNullChecks
   * @default true
   */
  strictNullChecks?: boolean;
}
type HelperMode =
/**
* Runtime mode (default): Helper functions are imported from a runtime package.
*
* Example:
*
* ```js
* import helperName from "@oxc-project/runtime/helpers/helperName";
* helperName(...arguments);
* ```
*/
'Runtime' |
/**
 * External mode: Helper functions are accessed from a global `babelHelpers` object.
 *
 * Example:
 *
 * ```js
 * babelHelpers.helperName(...arguments);
 * ```
 */
'External';
interface Helpers {
  mode?: HelperMode;
}
/**
 * TypeScript Isolated Declarations for Standalone DTS Emit (async)
 *
 * Note: This function can be slower than `isolatedDeclarationSync` due to the overhead of spawning a thread.
 */
declare function isolatedDeclaration(filename: string, sourceText: string, options?: IsolatedDeclarationsOptions | undefined | null): Promise<IsolatedDeclarationsResult>;
interface IsolatedDeclarationsOptions {
  /**
   * Do not emit declarations for code that has an @internal annotation in its JSDoc comment.
   * This is an internal compiler option; use at your own risk, because the compiler does not check that the result is valid.
   *
   * Default: `false`
   *
   * See <https://www.typescriptlang.org/tsconfig/#stripInternal>
   */
  stripInternal?: boolean;
  sourcemap?: boolean;
}
interface IsolatedDeclarationsResult {
  code: string;
  map?: SourceMap;
  errors: Array<OxcError>;
}
/** TypeScript Isolated Declarations for Standalone DTS Emit */
declare function isolatedDeclarationSync(filename: string, sourceText: string, options?: IsolatedDeclarationsOptions | undefined | null): IsolatedDeclarationsResult;
/**
 * Configure how TSX and JSX are transformed.
 *
 * @see {@link https://oxc.rs/docs/guide/usage/transformer/jsx}
 */
interface JsxOptions {
  /**
   * Decides which runtime to use.
   *
   * - 'automatic' - auto-import the correct JSX factories
   * - 'classic' - no auto-import
   *
   * @default 'automatic'
   */
  runtime?: 'classic' | 'automatic';
  /**
   * Emit development-specific information, such as `__source` and `__self`.
   *
   * @default false
   */
  development?: boolean;
  /**
   * Toggles whether or not to throw an error if an XML namespaced tag name
   * is used.
   *
   * Though the JSX spec allows this, it is disabled by default since React's
   * JSX does not currently have support for it.
   *
   * @default true
   */
  throwIfNamespace?: boolean;
  /**
   * Mark JSX elements and top-level React method calls as pure for tree shaking.
   *
   * @default true
   */
  pure?: boolean;
  /**
   * Replaces the import source when importing functions.
   *
   * @default 'react'
   */
  importSource?: string;
  /**
   * Replace the function used when compiling JSX expressions. It should be a
   * qualified name (e.g. `React.createElement`) or an identifier (e.g.
   * `createElement`).
   *
   * Only used for `classic` {@link runtime}.
   *
   * @default 'React.createElement'
   */
  pragma?: string;
  /**
   * Replace the component used when compiling JSX fragments. It should be a
   * valid JSX tag name.
   *
   * Only used for `classic` {@link runtime}.
   *
   * @default 'React.Fragment'
   */
  pragmaFrag?: string;
  /**
   * Enable React Fast Refresh .
   *
   * Conforms to the implementation in {@link https://github.com/facebook/react/tree/v18.3.1/packages/react-refresh}
   *
   * @default false
   */
  refresh?: boolean | ReactRefreshOptions;
}
/**
 * Transform JavaScript code to a Vite Node runnable module.
 *
 * @param filename The name of the file being transformed.
 * @param sourceText the source code itself
 * @param options The options for the transformation. See {@link
 * ModuleRunnerTransformOptions} for more information.
 *
 * @returns an object containing the transformed code, source maps, and any
 * errors that occurred during parsing or transformation.
 *
 * Note: This function can be slower than `moduleRunnerTransformSync` due to the overhead of spawning a thread.
 *
 * @deprecated Only works for Vite.
 */
declare function moduleRunnerTransform(filename: string, sourceText: string, options?: ModuleRunnerTransformOptions | undefined | null): Promise<ModuleRunnerTransformResult>;
interface ModuleRunnerTransformOptions {
  /**
   * Enable source map generation.
   *
   * When `true`, the `sourceMap` field of transform result objects will be populated.
   *
   * @default false
   *
   * @see {@link SourceMap}
   */
  sourcemap?: boolean;
}
interface ModuleRunnerTransformResult {
  /**
   * The transformed code.
   *
   * If parsing failed, this will be an empty string.
   */
  code: string;
  /**
   * The source map for the transformed code.
   *
   * This will be set if {@link TransformOptions#sourcemap} is `true`.
   */
  map?: SourceMap;
  deps: Array<string>;
  dynamicDeps: Array<string>;
  /**
   * Parse and transformation errors.
   *
   * Oxc's parser recovers from common syntax errors, meaning that
   * transformed code may still be available even if there are errors in this
   * list.
   */
  errors: Array<OxcError>;
}
interface PluginsOptions {
  styledComponents?: StyledComponentsOptions;
  taggedTemplateEscape?: boolean;
}
interface ReactRefreshOptions {
  /**
   * Specify the identifier of the refresh registration variable.
   *
   * @default `$RefreshReg$`.
   */
  refreshReg?: string;
  /**
   * Specify the identifier of the refresh signature variable.
   *
   * @default `$RefreshSig$`.
   */
  refreshSig?: string;
  emitFullSignatures?: boolean;
}
/**
 * Configure how styled-components are transformed.
 *
 * @see {@link https://oxc.rs/docs/guide/usage/transformer/plugins#styled-components}
 */
interface StyledComponentsOptions {
  /**
   * Enhances the attached CSS class name on each component with richer output to help
   * identify your components in the DOM without React DevTools.
   *
   * @default true
   */
  displayName?: boolean;
  /**
   * Controls whether the `displayName` of a component will be prefixed with the filename
   * to make the component name as unique as possible.
   *
   * @default true
   */
  fileName?: boolean;
  /**
   * Adds a unique identifier to every styled component to avoid checksum mismatches
   * due to different class generation on the client and server during server-side rendering.
   *
   * @default true
   */
  ssr?: boolean;
  /**
   * Transpiles styled-components tagged template literals to a smaller representation
   * than what Babel normally creates, helping to reduce bundle size.
   *
   * @default true
   */
  transpileTemplateLiterals?: boolean;
  /**
   * Minifies CSS content by removing all whitespace and comments from your CSS,
   * keeping valuable bytes out of your bundles.
   *
   * @default true
   */
  minify?: boolean;
  /**
   * Enables transformation of JSX `css` prop when using styled-components.
   *
   * **Note: This feature is not yet implemented in oxc.**
   *
   * @default true
   */
  cssProp?: boolean;
  /**
   * Enables "pure annotation" to aid dead code elimination by bundlers.
   *
   * @default false
   */
  pure?: boolean;
  /**
   * Adds a namespace prefix to component identifiers to ensure class names are unique.
   *
   * Example: With `namespace: "my-app"`, generates `componentId: "my-app__sc-3rfj0a-1"`
   */
  namespace?: string;
  /**
   * List of file names that are considered meaningless for component naming purposes.
   *
   * When the `fileName` option is enabled and a component is in a file with a name
   * from this list, the directory name will be used instead of the file name for
   * the component's display name.
   *
   * @default `["index"]`
   */
  meaninglessFileNames?: Array<string>;
  /**
   * Import paths to be considered as styled-components imports at the top level.
   *
   * **Note: This feature is not yet implemented in oxc.**
   */
  topLevelImportPaths?: Array<string>;
}
/**
 * Options for transforming a JavaScript or TypeScript file.
 *
 * @see {@link transform}
 */
interface TransformOptions {
  /** Treat the source text as `js`, `jsx`, `ts`, `tsx`, or `dts`. */
  lang?: 'js' | 'jsx' | 'ts' | 'tsx' | 'dts';
  /** Treat the source text as `script` or `module` code. */
  sourceType?: 'script' | 'module' | 'commonjs' | 'unambiguous' | undefined;
  /**
   * The current working directory. Used to resolve relative paths in other
   * options.
   */
  cwd?: string;
  /**
   * Enable source map generation.
   *
   * When `true`, the `sourceMap` field of transform result objects will be populated.
   *
   * @default false
   *
   * @see {@link SourceMap}
   */
  sourcemap?: boolean;
  /** Set assumptions in order to produce smaller output. */
  assumptions?: CompilerAssumptions;
  /**
   * Configure how TypeScript is transformed.
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/typescript}
   */
  typescript?: TypeScriptOptions;
  /**
   * Configure how TSX and JSX are transformed.
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/jsx}
   */
  jsx?: 'preserve' | JsxOptions;
  /**
   * Sets the target environment for the generated JavaScript.
   *
   * The lowest target is `es2015`.
   *
   * Example:
   *
   * * `'es2015'`
   * * `['es2020', 'chrome58', 'edge16', 'firefox57', 'node12', 'safari11']`
   *
   * @default `esnext` (No transformation)
   *
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/lowering#target}
   */
  target?: string | Array<string>;
  /** Behaviour for runtime helpers. */
  helpers?: Helpers;
  /**
   * Define Plugin
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/global-variable-replacement#define}
   */
  define?: Record<string, string>;
  /**
   * Inject Plugin
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/global-variable-replacement#inject}
   */
  inject?: Record<string, string | [string, string]>;
  /** Decorator plugin */
  decorator?: DecoratorOptions;
  /**
   * Third-party plugins to use.
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/plugins}
   */
  plugins?: PluginsOptions;
}
interface TypeScriptOptions {
  jsxPragma?: string;
  jsxPragmaFrag?: string;
  onlyRemoveTypeImports?: boolean;
  allowNamespaces?: boolean;
  /**
   * When enabled, type-only class fields are only removed if they are prefixed with the declare modifier:
   *
   * @deprecated
   *
   * Allowing `declare` fields is built-in support in Oxc without any option. If you want to remove class fields
   * without initializer, you can use `remove_class_fields_without_initializer: true` instead.
   */
  allowDeclareFields?: boolean;
  /**
   * When enabled, class fields without initializers are removed.
   *
   * For example:
   * ```ts
   * class Foo {
   *    x: number;
   *    y: number = 0;
   * }
   * ```
   * // transform into
   * ```js
   * class Foo {
   *    x: number;
   * }
   * ```
   *
   * The option is used to align with the behavior of TypeScript's `useDefineForClassFields: false` option.
   * When you want to enable this, you also need to set [`crate::CompilerAssumptions::set_public_class_fields`]
   * to `true`. The `set_public_class_fields: true` + `remove_class_fields_without_initializer: true` is
   * equivalent to `useDefineForClassFields: false` in TypeScript.
   *
   * When `set_public_class_fields` is true and class-properties plugin is enabled, the above example transforms into:
   *
   * ```js
   * class Foo {
   *   constructor() {
   *     this.y = 0;
   *   }
   * }
   * ```
   *
   * Defaults to `false`.
   */
  removeClassFieldsWithoutInitializer?: boolean;
  /**
   * When true, optimize const enums by inlining their values at usage sites
   * and removing the enum declaration.
   *
   * @default false
   */
  optimizeConstEnums?: boolean;
  /**
   * When true, optimize regular (non-const) enums by inlining their member
   * accesses at usage sites when the member value is statically known.
   *
   * Non-exported enum declarations are also removed when all members are
   * evaluable and no references to the enum as a runtime value exist
   * (e.g., `console.log(Foo)`, `typeof Foo`, or passing the enum as an argument).
   *
   * @default false
   */
  optimizeEnums?: boolean;
  /**
   * Also generate a `.d.ts` declaration file for TypeScript files.
   *
   * The source file must be compliant with all
   * [`isolatedDeclarations`](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-5.html#isolated-declarations)
   * requirements.
   *
   * @default false
   */
  declaration?: IsolatedDeclarationsOptions;
  /**
   * Rewrite or remove TypeScript import/export declaration extensions.
   *
   * - When set to `rewrite`, it will change `.ts`, `.mts`, `.cts` extensions to `.js`, `.mjs`, `.cjs` respectively.
   * - When set to `remove`, it will remove `.ts`/`.mts`/`.cts`/`.tsx` extension entirely.
   * - When set to `true`, it's equivalent to `rewrite`.
   * - When set to `false` or omitted, no changes will be made to the extensions.
   *
   * @default false
   */
  rewriteImportExtensions?: 'rewrite' | 'remove' | boolean;
}
/** A decoded source map with mappings as an array of arrays instead of VLQ-encoded string. */
declare class BindingDecodedMap {
  /** The source map version (always 3). */
  get version(): number;
  /** The generated file name. */
  get file(): string | null;
  /** The list of original source files. */
  get sources(): Array<string>;
  /** The original source contents (if `includeContent` was true). */
  get sourcesContent(): Array<string | undefined | null>;
  /** The list of symbol names used in mappings. */
  get names(): Array<string>;
  /**
   * The decoded mappings as an array of line arrays.
   * Each line is an array of segments, where each segment is [generatedColumn, sourceIndex, originalLine, originalColumn, nameIndex?].
   */
  get mappings(): Array<Array<Array<number>>>;
  /** The list of source indices that should be excluded from debugging. */
  get x_google_ignoreList(): Array<number> | null;
}
declare class BindingMagicString {
  constructor(source: string, options?: BindingMagicStringOptions | undefined | null);
  get original(): string;
  get filename(): string | null;
  get indentExclusionRanges(): Array<Array<number>> | Array<number> | null;
  get ignoreList(): boolean;
  get offset(): number;
  set offset(offset: number);
  replace(from: string, to: string): this;
  replaceAll(from: string, to: string): this;
  /**
   * Returns the UTF-16 offset past the last match, or -1 if no match was found.
   * The JS wrapper uses this to update `lastIndex` on the caller's RegExp.
   * Global/sticky behavior is derived from the regex's own flags.
   */
  replaceRegex(from: RegExp, to: string): number;
  prepend(content: string): this;
  append(content: string): this;
  prependLeft(index: number, content: string): this;
  prependRight(index: number, content: string): this;
  appendLeft(index: number, content: string): this;
  appendRight(index: number, content: string): this;
  overwrite(start: number, end: number, content: string, options?: BindingOverwriteOptions | undefined | null): this;
  toString(): string;
  hasChanged(): boolean;
  length(): number;
  isEmpty(): boolean;
  remove(start: number, end: number): this;
  update(start: number, end: number, content: string, options?: BindingUpdateOptions | undefined | null): this;
  relocate(start: number, end: number, to: number): this;
  /**
   * Alias for `relocate` to match the original magic-string API.
   * Moves the characters from `start` to `end` to `index`.
   * Returns `this` for method chaining.
   */
  move(start: number, end: number, index: number): this;
  indent(indentor?: string | undefined | null, options?: BindingIndentOptions | undefined | null): this;
  /** Trims whitespace or specified characters from the start and end. */
  trim(charType?: string | undefined | null): this;
  /** Trims whitespace or specified characters from the start. */
  trimStart(charType?: string | undefined | null): this;
  /** Trims whitespace or specified characters from the end. */
  trimEnd(charType?: string | undefined | null): this;
  /** Trims newlines from the start and end. */
  trimLines(): this;
  /**
   * Deprecated method that throws an error directing users to use prependRight or appendLeft.
   * This matches the original magic-string API which deprecated this method.
   */
  insert(index: number, content: string): void;
  /** Returns a clone of the MagicString instance. */
  clone(): BindingMagicString;
  /** Returns the last character of the generated string, or an empty string if empty. */
  lastChar(): string;
  /** Returns the content after the last newline in the generated string. */
  lastLine(): string;
  /** Returns the guessed indentation string, or `\t` if none is found. */
  getIndentString(): string;
  /** Returns a clone with content outside the specified range removed. */
  snip(start: number, end: number): BindingMagicString;
  /**
   * Resets the portion of the string from `start` to `end` to its original content.
   * This undoes any modifications made to that range.
   * Supports negative indices (counting from the end).
   */
  reset(start: number, end: number): this;
  /**
   * Returns the content between the specified UTF-16 code unit positions (JS string indices).
   * Supports negative indices (counting from the end).
   *
   * When an index falls in the middle of a surrogate pair, the lone surrogate is
   * included in the result (matching the original magic-string / JS behavior).
   * This is done by returning a UTF-16 encoded JS string via `napi_create_string_utf16`.
   */
  slice(start?: number | undefined | null, end?: number | undefined | null): string;
  /**
   * Generates a source map for the transformations applied to this MagicString.
   * Returns a BindingSourceMap object with version, file, sources, sourcesContent, names, mappings.
   */
  generateMap(options?: BindingSourceMapOptions | undefined | null): BindingSourceMap;
  /**
   * Generates a decoded source map for the transformations applied to this MagicString.
   * Returns a BindingDecodedMap object with mappings as an array of arrays.
   */
  generateDecodedMap(options?: BindingSourceMapOptions | undefined | null): BindingDecodedMap;
}
declare class BindingNormalizedOptions {
  get input(): Array<string> | Record<string, string>;
  get cwd(): string;
  get platform(): 'node' | 'browser' | 'neutral';
  get shimMissingExports(): boolean;
  get name(): string | null;
  get entryFilenames(): string | undefined;
  get chunkFilenames(): string | undefined;
  get assetFilenames(): string | undefined;
  get dir(): string | null;
  get file(): string | null;
  get format(): 'es' | 'cjs' | 'iife' | 'umd';
  get exports(): 'default' | 'named' | 'none' | 'auto';
  get esModule(): boolean | 'if-default-prop';
  get codeSplitting(): boolean;
  get dynamicImportInCjs(): boolean;
  get sourcemap(): boolean | 'inline' | 'hidden';
  get sourcemapBaseUrl(): string | null;
  get banner(): string | undefined | null | undefined;
  get footer(): string | undefined | null | undefined;
  get intro(): string | undefined | null | undefined;
  get outro(): string | undefined | null | undefined;
  get postBanner(): string | undefined | null | undefined;
  get postFooter(): string | undefined | null | undefined;
  get externalLiveBindings(): boolean;
  get extend(): boolean;
  get globals(): Record<string, string> | undefined;
  get hashCharacters(): 'base64' | 'base36' | 'hex';
  get sourcemapDebugIds(): boolean;
  get sourcemapExcludeSources(): boolean;
  get polyfillRequire(): boolean;
  get minify(): false | 'dce-only' | MinifyOptions;
  get legalComments(): 'none' | 'inline';
  get comments(): BindingCommentsOptions;
  get preserveModules(): boolean;
  get preserveModulesRoot(): string | undefined;
  get virtualDirname(): string;
  get topLevelVar(): boolean;
  get minifyInternalExports(): boolean;
  get context(): string;
}
declare class BindingRenderedChunk {
  get name(): string;
  get isEntry(): boolean;
  get isDynamicEntry(): boolean;
  get facadeModuleId(): string | null;
  get moduleIds(): Array<string>;
  get exports(): Array<string>;
  get fileName(): string;
  get modules(): BindingModules;
  get imports(): Array<string>;
  get dynamicImports(): Array<string>;
}
declare class BindingRenderedModule {
  get code(): string | null;
  get renderedExports(): Array<string>;
}
/** A source map object with properties matching the SourceMap V3 specification. */
declare class BindingSourceMap {
  /** The source map version (always 3). */
  get version(): number;
  /** The generated file name. */
  get file(): string | null;
  /** The list of original source files. */
  get sources(): Array<string>;
  /** The original source contents (if `includeContent` was true). */
  get sourcesContent(): Array<string | undefined | null>;
  /** The list of symbol names used in mappings. */
  get names(): Array<string>;
  /** The VLQ-encoded mappings string. */
  get mappings(): string;
  /** The list of source indices that should be excluded from debugging. */
  get x_google_ignoreList(): Array<number> | null;
  /** Returns the source map as a JSON string. */
  toString(): string;
  /** Returns the source map as a base64-encoded data URL. */
  toUrl(): string;
}
/**
 * Minimal wrapper around a `BundleHandle` for watcher events.
 * This is returned from watcher event data to allow calling `result.close()`.
 */
declare class BindingWatcherBundler {
  close(): Promise<void>;
}
declare class TsconfigCache {
  /** Create a new transform cache with auto tsconfig discovery enabled. */
  constructor(yarnPnp: boolean);
  /**
   * Clear the cache.
   *
   * Call this when tsconfig files have changed to ensure fresh resolution.
   */
  clear(): void;
  /** Get the number of cached entries. */
  size(): number;
}
type BindingBuiltinPluginName = 'builtin:bundle-analyzer' | 'builtin:esm-external-require' | 'builtin:isolated-declaration' | 'builtin:replace' | 'builtin:vite-alias' | 'builtin:vite-build-import-analysis' | 'builtin:vite-dynamic-import-vars' | 'builtin:vite-import-glob' | 'builtin:vite-json' | 'builtin:vite-load-fallback' | 'builtin:vite-manifest' | 'builtin:vite-module-preload-polyfill' | 'builtin:vite-react-refresh-wrapper' | 'builtin:vite-reporter' | 'builtin:vite-resolve' | 'builtin:vite-transform' | 'builtin:vite-wasm-fallback' | 'builtin:vite-web-worker-post' | 'builtin:oxc-runtime';
interface BindingBundleAnalyzerPluginConfig {
  /** Output filename for the bundle analysis data (default: "analyze-data.json") */
  fileName?: string;
  /** Output format: "json" (default) or "md" for LLM-friendly markdown */
  format?: 'json' | 'md';
}
interface BindingBundleState {
  lastFullBuildFailed: boolean;
  hasStaleOutput: boolean;
}
interface BindingClientHmrUpdate {
  clientId: string;
  update: BindingHmrUpdate;
}
interface BindingCommentsOptions {
  legal?: boolean;
  annotation?: boolean;
  jsdoc?: boolean;
}
interface BindingCompilerOptions {
  baseUrl?: string;
  paths?: Record<string, Array<string>>;
  experimentalDecorators?: boolean;
  emitDecoratorMetadata?: boolean;
  useDefineForClassFields?: boolean;
  rewriteRelativeImportExtensions?: boolean;
  jsx?: string;
  jsxFactory?: string;
  jsxFragmentFactory?: string;
  jsxImportSource?: string;
  verbatimModuleSyntax?: boolean;
  preserveValueImports?: boolean;
  importsNotUsedAsValues?: string;
  target?: string;
  module?: string;
  allowJs?: boolean;
  rootDirs?: Array<string>;
}
/** Enhanced transform options with tsconfig and inputMap support. */
interface BindingEnhancedTransformOptions {
  /** Treat the source text as 'js', 'jsx', 'ts', 'tsx', or 'dts'. */
  lang?: 'js' | 'jsx' | 'ts' | 'tsx' | 'dts';
  /** Treat the source text as 'script', 'module', 'commonjs', or 'unambiguous'. */
  sourceType?: 'script' | 'module' | 'commonjs' | 'unambiguous' | undefined;
  /**
   * The current working directory. Used to resolve relative paths in other
   * options.
   */
  cwd?: string;
  /**
   * Enable source map generation.
   *
   * When `true`, the `sourceMap` field of transform result objects will be populated.
   *
   * @default false
   */
  sourcemap?: boolean;
  /** Set assumptions in order to produce smaller output. */
  assumptions?: CompilerAssumptions;
  /**
   * Configure how TypeScript is transformed.
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/typescript}
   */
  typescript?: TypeScriptOptions;
  /**
   * Configure how TSX and JSX are transformed.
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/jsx}
   */
  jsx?: 'preserve' | JsxOptions;
  /**
   * Sets the target environment for the generated JavaScript.
   *
   * The lowest target is `es2015`.
   *
   * Example:
   *
   * * `'es2015'`
   * * `['es2020', 'chrome58', 'edge16', 'firefox57', 'node12', 'safari11']`
   *
   * @default `esnext` (No transformation)
   *
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/lowering#target}
   */
  target?: string | Array<string>;
  /** Behaviour for runtime helpers. */
  helpers?: Helpers;
  /**
   * Define Plugin
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/global-variable-replacement#define}
   */
  define?: Record<string, string>;
  /**
   * Inject Plugin
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/global-variable-replacement#inject}
   */
  inject?: Record<string, string | [string, string]>;
  /** Decorator plugin */
  decorator?: DecoratorOptions;
  /**
   * Third-party plugins to use.
   * @see {@link https://oxc.rs/docs/guide/usage/transformer/plugins}
   */
  plugins?: PluginsOptions;
  /**
   * Configure tsconfig handling.
   * - true: Auto-discover and load the nearest tsconfig.json
   * - TsconfigRawOptions: Use the provided inline tsconfig options
   */
  tsconfig?: boolean | BindingTsconfigRawOptions;
  /** An input source map to collapse with the output source map. */
  inputMap?: SourceMap;
}
/** Result of the enhanced transform API. */
interface BindingEnhancedTransformResult {
  /**
   * The transformed code.
   *
   * If parsing failed, this will be an empty string.
   */
  code: string;
  /**
   * The source map for the transformed code.
   *
   * This will be set if {@link BindingEnhancedTransformOptions#sourcemap} is `true`.
   */
  map?: SourceMap;
  /**
   * The `.d.ts` declaration file for the transformed code. Declarations are
   * only generated if `declaration` is set to `true` and a TypeScript file
   * is provided.
   *
   * If parsing failed and `declaration` is set, this will be an empty string.
   *
   * @see {@link TypeScriptOptions#declaration}
   * @see [declaration tsconfig option](https://www.typescriptlang.org/tsconfig/#declaration)
   */
  declaration?: string;
  /**
   * Declaration source map. Only generated if both
   * {@link TypeScriptOptions#declaration declaration} and
   * {@link BindingEnhancedTransformOptions#sourcemap sourcemap} are set to `true`.
   */
  declarationMap?: SourceMap;
  /**
   * Helpers used.
   *
   * @internal
   *
   * Example:
   *
   * ```text
   * { "_objectSpread": "@oxc-project/runtime/helpers/objectSpread2" }
   * ```
   */
  helpersUsed: Record<string, string>;
  /** Parse and transformation errors. */
  errors: Array<BindingError>;
  /** Parse and transformation warnings. */
  warnings: Array<BindingError>;
  /** Paths to tsconfig files that were loaded during transformation. */
  tsconfigFilePaths: Array<string>;
}
type BindingError = {
  type: 'JsError';
  field0: Error;
} | {
  type: 'NativeError';
  field0: NativeError;
};
interface BindingEsmExternalRequirePluginConfig {
  external: Array<BindingStringOrRegex>;
  skipDuplicateCheck?: boolean;
}
interface BindingHmrBoundaryOutput {
  boundary: string;
  acceptedVia: string;
}
type BindingHmrUpdate = {
  type: 'Patch';
  code: string;
  filename: string;
  sourcemap?: string;
  sourcemapFilename?: string;
  hmrBoundaries: Array<BindingHmrBoundaryOutput>;
} | {
  type: 'FullReload';
  reason?: string;
} | {
  type: 'Noop';
};
interface BindingHookResolveIdExtraArgs {
  custom?: number;
  isEntry: boolean;
  /**
   * - `import-statement`: `import { foo } from './lib.js';`
   * - `dynamic-import`: `import('./lib.js')`
   * - `require-call`: `require('./lib.js')`
   * - `import-rule`: `@import 'bg-color.css'`
   * - `url-token`: `url('./icon.png')`
   * - `new-url`: `new URL('./worker.js', import.meta.url)`
   * - `hot-accept`: `import.meta.hot.accept('./lib.js', () => {})`
   */
  kind: 'import-statement' | 'dynamic-import' | 'require-call' | 'import-rule' | 'url-token' | 'new-url' | 'hot-accept';
}
interface BindingIndentOptions {
  exclude?: Array<Array<number>> | Array<number>;
}
interface BindingIsolatedDeclarationPluginConfig {
  stripInternal?: boolean;
}
interface BindingLogLocation {
  /** 1-based */
  line: number;
  /** 0-based position in the line in UTF-16 code units */
  column: number;
  file?: string;
}
interface BindingMagicStringOptions {
  filename?: string;
  offset?: number;
  indentExclusionRanges?: Array<Array<number>> | Array<number>;
  ignoreList?: boolean;
}
interface BindingModulePreloadOptions {
  polyfill: boolean;
  resolveDependencies?: (filename: string, deps: string[], context: {
    hostId: string;
    hostType: 'html' | 'js';
  }) => string[];
}
interface BindingModules {
  values: Array<BindingRenderedModule>;
  keys: Array<string>;
}
interface BindingOverwriteOptions {
  contentOnly?: boolean;
}
interface BindingPluginContextResolveOptions {
  /**
   * - `import-statement`: `import { foo } from './lib.js';`
   * - `dynamic-import`: `import('./lib.js')`
   * - `require-call`: `require('./lib.js')`
   * - `import-rule`: `@import 'bg-color.css'`
   * - `url-token`: `url('./icon.png')`
   * - `new-url`: `new URL('./worker.js', import.meta.url)`
   * - `hot-accept`: `import.meta.hot.accept('./lib.js', () => {})`
   */
  importKind?: 'import-statement' | 'dynamic-import' | 'require-call' | 'import-rule' | 'url-token' | 'new-url' | 'hot-accept';
  isEntry?: boolean;
  skipSelf?: boolean;
  custom?: number;
  vitePluginCustom?: BindingVitePluginCustom;
}
declare enum BindingRebuildStrategy {
  Always = 0,
  Auto = 1,
  Never = 2
}
interface BindingRenderBuiltUrlConfig {
  ssr: boolean;
  type: 'asset' | 'public';
  hostId: string;
  hostType: 'js' | 'css' | 'html';
}
interface BindingRenderBuiltUrlRet {
  relative?: boolean;
  runtime?: string;
}
interface BindingReplacePluginConfig {
  values: Record<string, string>;
  delimiters?: [string, string];
  preventAssignment?: boolean;
  objectGuards?: boolean;
  sourcemap?: boolean;
}
interface BindingSourceMapOptions {
  /** The filename for the generated file (goes into `map.file`) */
  file?: string;
  /** The filename of the original source (goes into `map.sources`) */
  source?: string;
  includeContent?: boolean;
  /**
   * Accepts boolean or string: true, false, "boundary"
   * - true: high-resolution sourcemaps (character-level)
   * - false: low-resolution sourcemaps (line-level) - default
   * - "boundary": high-resolution only at word boundaries
   */
  hires?: boolean | string;
}
interface BindingTransformHookExtraArgs {
  moduleType: string;
}
interface BindingTsconfig {
  files?: Array<string>;
  include?: Array<string>;
  exclude?: Array<string>;
  compilerOptions: BindingCompilerOptions;
}
/**
 * TypeScript compiler options for inline tsconfig configuration.
 *
 * @category Utilities
 */
interface BindingTsconfigCompilerOptions {
  /** Specifies the JSX factory function to use. */
  jsx?: 'react' | 'react-jsx' | 'react-jsxdev' | 'preserve' | 'react-native';
  /** Specifies the JSX factory function. */
  jsxFactory?: string;
  /** Specifies the JSX fragment factory function. */
  jsxFragmentFactory?: string;
  /** Specifies the module specifier for JSX imports. */
  jsxImportSource?: string;
  /** Enables experimental decorators. */
  experimentalDecorators?: boolean;
  /** Enables decorator metadata emission. */
  emitDecoratorMetadata?: boolean;
  /** Preserves module structure of imports/exports. */
  verbatimModuleSyntax?: boolean;
  /** Configures how class fields are emitted. */
  useDefineForClassFields?: boolean;
  /** The ECMAScript target version. */
  target?: string;
  /** @deprecated Use verbatimModuleSyntax instead. */
  preserveValueImports?: boolean;
  /** @deprecated Use verbatimModuleSyntax instead. */
  importsNotUsedAsValues?: 'remove' | 'preserve' | 'error';
}
/**
 * Raw tsconfig options for inline configuration.
 *
 * @category Utilities
 */
interface BindingTsconfigRawOptions {
  /** TypeScript compiler options. */
  compilerOptions?: BindingTsconfigCompilerOptions;
}
interface BindingTsconfigResult {
  tsconfig: BindingTsconfig;
  tsconfigFilePaths: Array<string>;
}
interface BindingUpdateOptions {
  overwrite?: boolean;
}
interface BindingViteBuildImportAnalysisPluginConfig {
  preloadCode: string;
  insertPreload: boolean;
  optimizeModulePreloadRelativePaths: boolean;
  renderBuiltUrl: boolean;
  isRelativeBase: boolean;
  v2?: BindingViteBuildImportAnalysisPluginV2Config;
}
interface BindingViteBuildImportAnalysisPluginV2Config {
  isSsr: boolean;
  urlBase: string;
  decodedBase: string;
  modulePreload: false | BindingModulePreloadOptions;
  renderBuiltUrl?: (filename: string, type: BindingRenderBuiltUrlConfig) => undefined | string | BindingRenderBuiltUrlRet;
}
interface BindingViteDynamicImportVarsPluginConfig {
  sourcemap?: boolean;
  include?: Array<BindingStringOrRegex>;
  exclude?: Array<BindingStringOrRegex>;
  resolver?: (id: string, importer: string) => MaybePromise<string | undefined>;
}
interface BindingViteImportGlobPluginConfig {
  root?: string;
  sourcemap?: boolean;
  restoreQueryExtension?: boolean;
}
interface BindingViteJsonPluginConfig {
  minify?: boolean;
  namedExports?: boolean;
  stringify?: BindingViteJsonPluginStringify;
}
type BindingViteJsonPluginStringify = boolean | string;
interface BindingViteManifestPluginConfig {
  root: string;
  outPath: string;
  isEnableV2?: boolean;
  isLegacy?: (args: BindingNormalizedOptions) => boolean;
  cssEntries: () => Record<string, string>;
}
interface BindingViteModulePreloadPolyfillPluginConfig {
  isServer?: boolean;
}
interface BindingVitePluginCustom {
  'vite:import-glob'?: ViteImportGlobMeta;
}
interface BindingViteReactRefreshWrapperPluginConfig {
  cwd: string;
  include?: Array<BindingStringOrRegex>;
  exclude?: Array<BindingStringOrRegex>;
  jsxImportSource: string;
  reactRefreshHost: string;
}
interface BindingViteReporterPluginConfig {
  root: string;
  isTty: boolean;
  isLib: boolean;
  assetsDir: string;
  chunkLimit: number;
  warnLargeChunks: boolean;
  reportCompressedSize: boolean;
  logInfo?: (msg: string) => void;
}
interface BindingViteResolvePluginConfig {
  resolveOptions: BindingViteResolvePluginResolveOptions;
  environmentConsumer: string;
  environmentName: string;
  builtins: Array<BindingStringOrRegex>;
  external: true | string[];
  noExternal: true | Array<string | RegExp>;
  dedupe: Array<string>;
  disableCache?: boolean;
  legacyInconsistentCjsInterop?: boolean;
  finalizeBareSpecifier?: (resolvedId: string, rawId: string, importer: string | null | undefined) => VoidNullable<string>;
  finalizeOtherSpecifiers?: (resolvedId: string, rawId: string) => VoidNullable<string>;
  resolveSubpathImports: (id: string, importer: string, isRequire: boolean, scan: boolean) => VoidNullable<string>;
  onWarn?: (message: string) => void;
  onDebug?: (message: string) => void;
  yarnPnp: boolean;
}
interface BindingViteResolvePluginResolveOptions {
  isBuild: boolean;
  isProduction: boolean;
  asSrc: boolean;
  preferRelative: boolean;
  isRequire?: boolean;
  root: string;
  scan: boolean;
  mainFields: Array<string>;
  conditions: Array<string>;
  externalConditions: Array<string>;
  extensions: Array<string>;
  tryIndex: boolean;
  tryPrefix?: string;
  preserveSymlinks: boolean;
  tsconfigPaths: boolean;
}
interface BindingViteTransformPluginConfig {
  root: string;
  include?: Array<BindingStringOrRegex>;
  exclude?: Array<BindingStringOrRegex>;
  jsxRefreshInclude?: Array<BindingStringOrRegex>;
  jsxRefreshExclude?: Array<BindingStringOrRegex>;
  isServerConsumer?: boolean;
  jsxInject?: string;
  transformOptions?: TransformOptions;
  yarnPnp?: boolean;
}
interface ExternalMemoryStatus {
  freed: boolean;
  reason?: string;
}
/** Error emitted from native side, it only contains kind and message, no stack trace. */
interface NativeError {
  kind: string;
  message: string;
  /** The id of the file associated with the error */
  id?: string;
  /** The exporter associated with the error (for import/export errors) */
  exporter?: string;
  /** Location information (line, column, file) */
  loc?: BindingLogLocation;
  /** Position in the source file in UTF-16 code units */
  pos?: number;
}
interface PreRenderedChunk {
  /** The name of this chunk, which is used in naming patterns. */
  name: string;
  /** Whether this chunk is a static entry point. */
  isEntry: boolean;
  /** Whether this chunk is a dynamic entry point. */
  isDynamicEntry: boolean;
  /** The id of a module that this chunk corresponds to. */
  facadeModuleId?: string;
  /** The list of ids of modules included in this chunk. */
  moduleIds: Array<string>;
  /** Exported variable names from this chunk. */
  exports: Array<string>;
}
interface ViteImportGlobMeta {
  isSubImportsPattern?: boolean;
}
//#endregion
export { AssignmentPattern as $, TSInferType as $n, UpdateExpression as $r, JSXMemberExpression as $t, ExternalMemoryStatus as A, SwitchStatement as An, TSTupleType as Ar, ForStatement as At, ResolveResult as B, TSConstructorType as Bn, TSTypeQuery as Br, ImportNamespaceSpecifier as Bt, BindingViteManifestPluginConfig as C, ReturnStatement as Cn, TSRestType as Cr, ExportAllDeclaration as Ct, BindingViteResolvePluginConfig as D, StringLiteral as Dn, TSTemplateLiteralType as Dr, ExpressionStatement as Dt, BindingViteReporterPluginConfig as E, StaticBlock as En, TSSymbolKeyword as Er, ExportSpecifier as Et, MinifyResult as F, TSBooleanKeyword as Fn, TSTypeOperator as Fr, IfStatement as Ft, isolatedDeclaration as G, TSExternalModuleReference as Gn, TSVoidKeyword as Gr, JSXAttribute as Gt, SourceMap as H, TSEnumDeclaration as Hn, TSUndefinedKeyword as Hr, JSDocNonNullableType as Ht, NapiResolveOptions as I, TSCallSignatureDeclaration as In, TSTypeParameter as Ir, ImportAttribute as It, AccessorProperty as J, TSImportEqualsDeclaration as Jn, TemplateLiteral as Jr, JSXElement as Jt, isolatedDeclarationSync as K, TSFunctionType as Kn, TaggedTemplateExpression as Kr, JSXClosingElement as Kt, ParseResult as L, TSClassImplements as Ln, TSTypeParameterDeclaration as Lr, ImportDeclaration as Lt, IsolatedDeclarationsResult as M, TSArrayType as Mn, TSTypeAnnotation as Mr, Function as Mt, JsxOptions as N, TSAsExpression as Nn, TSTypeAssertion as Nr, IdentifierName as Nt, BindingViteTransformPluginConfig as O, Super as On, TSThisParameter as Or, ForInStatement as Ot, MinifyOptions as P, TSBigIntKeyword as Pn, TSTypeLiteral as Pr, IdentifierReference as Pt, AssignmentExpression as Q, TSIndexedAccessType as Qn, UnaryExpression as Qr, JSXIdentifier as Qt, ParserOptions as R, TSConditionalType as Rn, TSTypeParameterInstantiation as Rr, ImportDefaultSpecifier as Rt, BindingViteJsonPluginConfig as S, RegExpLiteral as Sn, TSQualifiedName as Sr, EmptyStatement as St, BindingViteReactRefreshWrapperPluginConfig as T, SpreadElement as Tn, TSStringKeyword as Tr, ExportNamedDeclaration as Tt, TransformOptions as U, TSEnumMember as Un, TSUnionType as Ur, JSDocNullableType as Ut, ResolverFactory as V, TSEnumBody as Vn, TSTypeReference as Vr, ImportSpecifier as Vt, TsconfigCache as W, TSExportAssignment as Wn, TSUnknownKeyword as Wr, JSDocUnknownType as Wt, ArrayPattern as X, TSIndexSignature as Xn, ThrowStatement as Xr, JSXExpressionContainer as Xt, ArrayExpression as Y, TSImportType as Yn, ThisExpression as Yr, JSXEmptyExpression as Yt, ArrowFunctionExpression as Z, TSIndexSignatureName as Zn, TryStatement as Zr, JSXFragment as Zt, BindingTsconfigRawOptions as _, ObjectProperty as _n, TSObjectKeyword as _r, ConditionalExpression as _t, BindingEnhancedTransformOptions as a, YieldExpression as ai, JSXText as an, TSIntrinsicKeyword as ar, BinaryExpression as at, BindingViteDynamicImportVarsPluginConfig as b, Program as bn, TSParenthesizedType as br, Decorator as bt, BindingHookResolveIdExtraArgs as c, LogicalExpression as cn, TSMethodSignature as cr, BindingRestElement as ct, BindingPluginContextResolveOptions as d, MethodDefinition as dn, TSNamedTupleMember as dr, BreakStatement as dt, V8IntrinsicExpression as ei, JSXNamespacedName as en, TSInstantiationExpression as er, AssignmentTargetProperty as et, BindingRebuildStrategy as f, NewExpression as fn, TSNamespaceExportDeclaration as fr, CallExpression as ft, BindingTsconfigCompilerOptions as g, ObjectPattern as gn, TSNumberKeyword as gr, ClassBody as gt, BindingTransformHookExtraArgs as h, ObjectExpression as hn, TSNullKeyword as hr, Class as ht, BindingClientHmrUpdate as i, WithStatement as ii, JSXSpreadChild as in, TSIntersectionType as ir, BigIntLiteral as it, IsolatedDeclarationsOptions as j, TSAnyKeyword as jn, TSTypeAliasDeclaration as jr, FormalParameterRest as jt, BindingWatcherBundler as k, SwitchCase as kn, TSThisType as kr, ForOfStatement as kt, BindingIsolatedDeclarationPluginConfig as l, MemberExpression as ln, TSModuleBlock as lr, BlockStatement as lt, BindingReplacePluginConfig as m, NumericLiteral as mn, TSNonNullExpression as mr, ChainExpression as mt, BindingBundleAnalyzerPluginConfig as n, VariableDeclarator as ni, JSXOpeningFragment as nn, TSInterfaceDeclaration as nr, AssignmentTargetRest as nt, BindingEnhancedTransformResult as o, types_d_exports as oi, LabelIdentifier as on, TSLiteralType as or, BindingIdentifier as ot, BindingRenderedChunk as p, NullLiteral as pn, TSNeverKeyword as pr, CatchClause as pt, moduleRunnerTransform as q, TSGlobalDeclaration as qn, TemplateElement as qr, JSXClosingFragment as qt, BindingBundleState as r, WhileStatement as ri, JSXSpreadAttribute as rn, TSInterfaceHeritage as rr, AwaitExpression as rt, BindingEsmExternalRequirePluginConfig as s, LabeledStatement as sn, TSMappedType as sr, BindingProperty as st, BindingBuiltinPluginName as t, VariableDeclaration as ti, JSXOpeningElement as tn, TSInterfaceBody as tr, AssignmentTargetPropertyProperty as tt, BindingMagicString as u, MetaProperty as un, TSModuleDeclaration as ur, BooleanLiteral as ut, BindingTsconfigResult as v, ParenthesizedExpression as vn, TSOptionalType as vr, ContinueStatement as vt, BindingViteModulePreloadPolyfillPluginConfig as w, SequenceExpression as wn, TSSatisfiesExpression as wr, ExportDefaultDeclaration as wt, BindingViteImportGlobPluginConfig as x, PropertyDefinition as xn, TSPropertySignature as xr, DoWhileStatement as xt, BindingViteBuildImportAnalysisPluginConfig as y, PrivateIdentifier as yn, TSParameterProperty as yr, DebuggerStatement as yt, PreRenderedChunk as z, TSConstructSignatureDeclaration as zn, TSTypePredicate as zr, ImportExpression as zt };