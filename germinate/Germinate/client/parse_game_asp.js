function parseGameASP(asp) {
  const statementTypesToIgnore = ['label', 'controlLogic', 'timer_logic', 'boundary'];
  const [rulesASP, _rulesHTML] = asp.split('==========');
  const statements = rulesASP.split('\n').filter(asp => asp.length > 0).map(parseStatement);
  const thingSet = {};

  for (let statement of statements) {
    const [head, ...rest] = statement;
    if (statementTypesToIgnore.includes(head)) {
      // ignore
    }
    else if (head === 'entity' || head === 'resource') {
      // create a thing with the appropriate identifying info
      const id = rest[0];
      const thing = getOrCreate(thingSet, id);
      thing.type = head;
    }
    else if (head === 'many' || head === 'singular') {
      // tag corresponding entity as many or singular
      const id = rest[0][1];
      const thing = getOrCreate(thingSet, id);
      const value = {'singular': 'just one', 'many': 'several'}[head];
      thing.tags.push({family: 'quantity', value});
    }
    else if (head === 'initialize') {
      parseInitializeStatement(thingSet, rest);
    }
    else if (head === 'pool') {
      // TODO parse to tag entity with spawn information?
    }
    else if (head === 'precondition') {
      parsePreconditionStatement(thingSet, rest);
    }
    else if (head === 'result') {
      parseResultStatement(thingSet, rest);
    }
    else if (head === 'reading') {
      parseReadingStatement(thingSet, rest);
    }
    else {
      console.warn('Unrecognized ASP statement type', head, statement);
    }
  }

  return {things: thingSet, statements};
}


/// parse specific kinds of ASP statements from JSON S-expressions to build up a thingSet

function parseInitializeStatement(thingSet, rest) {
  // if set_value, classify the scalar it's being set to as high/middling/low/etc
  // and tag the corresponding resource appropriately; otherwise ignore for now
  const [initType, ...initArgs] = rest[0];
  if (initType === 'set_value') {
    const [[_resource, resourceID], [_scalar, value]] = initArgs;
    const thing = getOrCreate(thingSet, resourceID);
    const intValue = parseInt(value, 10);
    let valueRange;
    if (intValue === 10) { valueRange = 'full'; }
    else if (intValue > 7) { valueRange = 'high'; }
    else if (intValue > 4) { valueRange = 'middling'; }
    else if (intValue > 0) { valueRange = 'low'; }
    else { valueRange = 'empty'; }
    const tag = thing.tags.find(t => t.family === 'initialLevel');
    if (tag) {
      tag.value = valueRange;
    } else {
      thing.tags.push({family: 'initialLevel', value: valueRange});
    }
  }
}

function parsePreconditionStatement(thingSet, rest) {
  // create corresponding trigger thing if it doesn't already exist
  const id = rest[1] === 'tick' ? 'tick' : rest[1][1];
  const thing = getOrCreate(thingSet, id);
  thing.type = 'trigger'; // in case this isn't set yet
  thing.when = thing.when || [];
  let condType = id === 'tick' ? 'Every tick' : null;
  if (!condType) {
    condType = {
      ge: 'Resource greater than value',
      le: 'Resource less than value',
      overlaps: 'Entity collides with entity',
      timer_elapsed: 'Periodically',
    }[rest[0][0]];
  }
  let params = [];
  if (id !== 'tick') {
    const [condHead, ...condArgs] = rest[0];
    for (let arg of condArgs) {
      if (condHead === 'timer_elapsed') {
        params.push(arg); // assume there's only one arg: a timer name
      }
      else if (['entity','resource','scalar','amount'].includes(arg[0])) {
        params.push(arg[1]);
      }
      else if (arg[0] === 'property') {
        const [_, target, propName] = arg;
        const targetID = target[1]; // assume target[0] is a type specifier, probably 'entity'
        params.push(targetID + '.' + propName);
      }
      else if (arg[0] === 'button') {
        // assume this will always be button(mouse,pressed|held)?
        // if so, we can assume this means we're inside a control_event precondition,
        // and that this is the only argument for that precondition
        // (and therefore that none of the arguments actually change the behavior?)
        if (arg[1] !== 'mouse' || !(['pressed','held'].includes(arg[2]))) console.warn('invalid button precond arg?', arg);
        condType = arg[2] === 'pressed' ? 'Mouse is clicked' : 'Mouse is held';
        params = [];
      }
      else if (arg[0] === 'click') {
        // assume this is always click(entity(eid))?
        // if so, we can assume this means we're inside a control_event precondition,
        // and that the entity being clicked is the only argument
        if (arg[1][0] !== 'entity') console.warn('invalid click precond arg?', arg);
        condType = 'Entity is clicked';
        params = [arg[1][1]];
      }
      else if (arg === 'true' || arg === 'false') {
        // i've only seen these as superfluous last-args to overlaps(E1,E2,BOOL).
        // always true, never false under current generation constraints?
        if (condHead !== 'overlaps' || arg !== 'true') console.warn('invalid bool precond arg?', arg);
        params.push(arg);
      }
      else {
        console.warn('Invalid precondition argument', arg);
        params.push(arg);
      }
    }
  }
  thing.when.push({cond: condType || 'COND', params});
}

function parseResultStatement(thingSet, rest) {
  // create corresponding trigger thing if it doesn't already exist
  const id = rest[0] === 'tick' ? 'tick' : rest[0][1];
  const thing = getOrCreate(thingSet, id);
  thing.type = 'trigger'; // in case this isn't set yet
  const [resultHead, ...resultArgs] = rest[1];
  let resultType = {
    add: 'Spawn entity',
    delete: 'Delete entity',
    increase: 'Increase resource value',
    increase_over_time: 'Increase resource value',
    decrease: 'Decrease resource value',
    decrease_over_time: 'Decrease resource value',
    moves: 'Move entity in direction',
    rotate_to: 'Rotate entity by angle',
    look_at: 'Make entity look at',
    mode_change: ['game_loss','narrative_gating'].includes(resultArgs[0]) ? 'Lose game' : 'Win game',
    apply_restitution: 'Prevent entity overlap',
  }[resultHead];
  const params = resultArgs.map((arg) => {
    if (['entity','resource','scalar','amount'].includes(arg[0])) {
      return arg[1];
    }
    else if (arg[0] === 'property') {
      const [_, target, propName] = arg;
      const targetID = target[1]; // assume target[0] is a type specifier, probably 'entity'
      return targetID + '.' + propName;
    }
    else if (arg[0] === 'random_int') {
      const [_, [__, lower], [___, upper]] = arg;
      return `random(${lower},${upper})`;
    }
    else if (arg[0] === 'pool') {
      return null;
    }
    else {
      return JSON.stringify(arg);
    }
  }).filter(arg => !!arg);
  // TODO properly parse out individual resultTypes, instead of just forcing them into a common structure like this
  thing.then = thing.then || [];
  thing.then.push({action: resultType || 'RESULT', params});
}

function parseReadingStatement(thingSet, rest) {
  const readingType = rest[0];
  const relations = ['help','hurt','chases','flees','sharing','produces','consumes','costs','tradeoff'];
  // help is just a stub rn
  if (relations.includes(readingType)) {
    // create relationship thing
    const [_, lhsExpr, rhsExpr] = rest[1];
    if (!rhsExpr) return; // bail out early if this isn't a relational reading after all (as in eg tradeoff(Outcome)?)
    if (readingType === 'produces' && lhsExpr[0] === 'pool') return; // bail out early if this is a 'pool produces entity' reading
    const lhsID = lhsExpr[1];
    const rhsIsProp = rhsExpr[0] === 'property';
    const rhsID = rhsIsProp ? rhsExpr[1][1] : rhsExpr[1];
    const prop  = rhsIsProp ? rhsExpr[2] : null;
    const lhsName = lhsID; // TODO actually get name of thing with lhsID
    const rhsName = rhsID; // TODO actually get name of thing with rhsID
    const thing = {
      id: genID(),
      type: 'relationship',
      lhs: lhsName,
      reltype: rest[0],
      rhs: prop ? `${rhsName}.${prop}` : rhsName
    };
    thingSet[thing.id] = thing;
  }
  else if (readingType === 'good' || readingType === 'bad') {
    const thingInfo = rest[1];
    if (thingInfo[0] === 'entity' || thingInfo[0] === 'resource') {
      // for good/bad tags applying to entities/resources, apply them
      const thing = getOrCreate(thingSet, thingInfo[1]);
      const tag = thing.tags.find(t => t.family === 'playerAttitude');
      if (tag) {
        tag.value = 'complicated';
      } else {
        thing.tags.push({family: 'playerAttitude', value: readingType});
      }
    }
    // ignore thingInfo === 'tick', thingInfo[0] === 'outcome', thingInfo[0] === 'pool', others?
  }
  else {
    // ignore readingType[0] === 'goal' (for goal(reduce/increase)), others?
  }
}

function getOrCreate(thingSet, id) {
  let thing = thingSet[id];
  if (!thing) {
    thing = {id, tags: []};
    thingSet[id] = thing;
  }
  return thing;
}


/// parse raw ASP output to JSON S-expressions: ["arrays", ["of", "strings"], "like", ["this"]]

function parseStatement(asp) {
  asp = asp.replace(/\.$/, ''); // strip trailing period if any
  return parseExpression(asp);
}

function parseExpression(asp) {
  // return early if this isn't a compound expression
  if (!asp.includes('(')) return asp;

  // split on first open-paren
  const firstParenIdx = asp.indexOf('(');
  const before = asp.substring(0, firstParenIdx);
  const after = asp.substring(firstParenIdx + 1, asp.length - 1); // trim the outermost parens

  // parse out the comma-separated bits of the inner content
  let bits = [];
  let currentBit = '';
  let depth = 0;
  for (let i = 0; i < after.length; i++) {
    const ch = after[i];
    if (ch === ',' && depth === 0) {
      bits.push(currentBit);
      currentBit = '';
    } else {
      if (ch === '(') depth += 1;
      if (ch === ')') depth -= 1;
      currentBit += ch;
    }
  }
  if (currentBit.length > 0) bits.push(currentBit);

  // recursively parse all the inner bits
  bits = bits.map(parseExpression);

  // return a sexpr basically
  return [before, ...bits];
}
