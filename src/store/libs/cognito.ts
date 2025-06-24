import { Iot } from 'aws-sdk';
import { IOT_POLICY_NAME, AWS_REGION } from '@/constant';
import { Auth } from 'aws-amplify';

export const attachPolicy = async (identityId: string) => {
  try {
    const iot = new Iot({
      region: AWS_REGION,
      credentials: await Auth.currentCredentials()
    });
    
    await iot.attachPolicy({
      policyName: IOT_POLICY_NAME,
      target: identityId
    }).promise();
    
    console.log('Successfully attached IoT policy to user:', identityId);
    return true;
  } catch (error) {
    console.error('Error attaching IoT policy:', error);
    // Don't throw the error, just return false to indicate failure
    return false;
  }
}; 