import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

/* «Llámame»: un interruptor encima de la caja de chat. Activado, Claude sabe que debe llamar al celular del dueño
   (habilidad llamar-al-dueno, herramienta llamar.mjs de la app Pendientes) cuando necesite un permiso o una decisión.
   El estado se guarda entre sesiones. */

const isOn = atom({ plugin: 'llamame', key: 'isOn' } as const, false)

const RULE = [
  'MODO LLÁMAME ACTIVADO: el dueño no está mirando el chat.',
  'Cuando necesites su permiso o una decisión suya para seguir (borrar, publicar, gastar, elegir entre caminos), no esperes en el chat:',
  'llámalo al celular con la habilidad llamar-al-dueno (orden «llamar» con el motivo y las opciones numeradas en --contexto).',
  'Lee la transcripción y haz lo que eligió. Si no contesta, déjale las opciones con «mensaje» y sigue con lo que no dependa de esa decisión, sin hacer nada irreversible.',
  'No llames para avisos ni charla: para eso usa «mensaje». Habla en español.',
].join(' ')

async function setOn($: EngineInterface, value: boolean) {
  await update($, isOn, () => value)
  await $.store.set('isOn', value)
  $.ui.status(value ? '📞 Llámame: activado' : undefined)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const saved = (await $.store.get('isOn')) === true
    await update($, isOn, () => saved)
    if (saved) $.ui.status('📞 Llámame: activado')
    await $.command.register({ name: 'llamame', description: 'Activa o desactiva que Claude te llame al celular cuando necesite tu permiso' })
    return next(e)
  })

  on('command.run', { command: 'llamame' }, async ($, e) => {
    const value = !(await read($, isOn))
    await setOn($, value)
    return { text: value ? '📞 Llámame activado: si necesito tu permiso, te llamo al celular.' : 'Llámame desactivado: te pregunto aquí en el chat.' }
  })

  on('prompt.compose', async ($, e, next) => {
    const result = await next(e)
    if (!(await read($, isOn))) return result
    return { sections: [...result.sections, { id: 'llamame:regla', text: RULE, scope: 'session' as const }] }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const on_ = await read($, isOn)
    const { Box, Button, Text } = $.ui.resolve(e)
    return (
      <Box>
        <Button
          key="toggle"
          label={on_ ? '📞 Llámame: SÍ' : '📞 Llámame: no'}
          onPress={() => setOn($, !on_)}
        />
        <Text dimColor>{on_ ? '  Te llamo al celular si necesito tu permiso.' : '  Actívalo y te llamo si necesito tu permiso.'}</Text>
      </Box>
    )
  })
}
