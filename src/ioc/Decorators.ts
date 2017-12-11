import 'reflect-metadata';

export const INCEPTUM_METADATA_KEY = 'inceptum';

function getOrCreateMetadata(target: any) {
  if (Reflect.hasMetadata(INCEPTUM_METADATA_KEY, target)) {
    return Reflect.getMetadata(INCEPTUM_METADATA_KEY, target);
  }
  const metadata = {};
  Reflect.defineMetadata(INCEPTUM_METADATA_KEY, metadata, target);
  return metadata;
}

export function Autowire(what: string | {ref?: string, type?: string}) {
  return (target: any, key: string) => {
    // console.log('Called Autowire');
    const metadata = getOrCreateMetadata(target);
    if (metadata && !Object.hasOwnProperty.call(metadata, 'autowire')) {
      metadata['autowire'] = {};
    }
    metadata['autowire'][key] = what;
  };
}

export function Lazy(lazy: boolean) {
  return (target) => {
    const metadata = getOrCreateMetadata(target.prototype);
    metadata['lazy'] = lazy;
    // console.log('Called Lazy with ', lazy, target.prototype);
  };
}
