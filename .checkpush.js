
var gitParams = process.env.GIT_PARAMS;
var parts = gitParams.split(' ');

var originName = parts[0];
if (originName === 'typescript-base') {
  console.log('Pushing to typescript-base origin is disabled');
  process.exit(1);
}