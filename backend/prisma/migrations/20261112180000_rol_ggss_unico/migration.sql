-- Un solo rol de guardia: 'pauta' y 'libre' pasan a 'ggss'. En pauta/libre se deriva de los turnos.
UPDATE "Usuario" SET rol = 'ggss', tipo_ggss = NULL WHERE rol IN ('pauta', 'libre');
