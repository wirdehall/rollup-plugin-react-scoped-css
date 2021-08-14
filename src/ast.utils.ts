function isNode(obj: unknown) {
  return typeof obj === 'object' && 
      typeof (obj as any)?.end === 'number' && 
      typeof (obj as any)?.start === 'number' && 
      typeof (obj as any)?.type === 'string'
}

function isReactCreateElementCallExpression(node: any) {
  return node?.type === 'CallExpression' && 
    node?.callee?.object?.name === 'React' &&
    node?.callee?.property?.name === 'createElement'
}

function isFragmentCallExpression(node: any) {
  return node?.arguments?.[0]?.object?.name === "React" && node?.arguments?.[0]?.property?.name === "Fragment"
}

function traverse(ast: any, callback: Function) {
  for (let key of Object.keys(ast)) {
    if (['end', 'start', 'type'].includes(key)) { continue; }

    if (Array.isArray(ast[key])) {
      for (let nodeIndex in ast[key]) {
        ast[key][nodeIndex] = traverse(ast[key][nodeIndex], callback)
      }
    } else if(isNode(ast[key])) {
      ast[key] = traverse(ast[key], callback)
    }
  }

  const result = callback(ast);

  return typeof result !== 'undefined' ? result : ast
}

function createAttributeNode(attr: string) {
  return {
    type: 'Property',
    method: false,
    shorthand: false,
    computed: false,
    key: {
      type: 'Identifier',
      name: `"${attr}"`
    },
    value: {
      type: 'Literal',
      value: true,
      raw: "true"
    },
    kind: 'init'
  }
}

export function addHashAttributesToJsxTagsAst(program: any, attr: string) {
  return traverse(program, (node: any) => {
    if (isReactCreateElementCallExpression(node) && !isFragmentCallExpression(node)) {
      const arg = node?.arguments?.[1]
      return {
        ...node,
        arguments: node?.arguments.map((v: any, i: number) => {
          if (i === 1) {
              if (v.type === 'ObjectExpression') {
                return {
                  ...v,
                  properties: [
                    ...arg.properties,
                    createAttributeNode(attr)
                  ]
                }
              } else {
                return {
                  type: 'ObjectExpression',
                  properties: [createAttributeNode(attr)]
                }
              }
            }
            return v
          })
        }
    }
  })
}