import { userPoolId, userPoolWebClientId, AWS_REGION, identityPoolId } from "@/constant";

const awsExports = {
  Auth: {
    region: AWS_REGION,
    userPoolId: userPoolId,
    userPoolWebClientId: userPoolWebClientId,
    identityPoolId: identityPoolId,
  }
};

export default awsExports; 