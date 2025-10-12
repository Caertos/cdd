import Docker from 'dockerode';
const docker = new Docker({ socketPath: '/var/run/docker.sock'});

export async function getContainers() {
    const containers = await
docker.listContainers({ all: true });
    return containers.map(container => ({
        id: container.Id,
        name: container.Names[0].replace('/', ''),
        image: container.Image,
        state: container.State,
        status: container.Status,
        ports: container.Ports.map(port => `${port.PublicPort
            || '' }:${port.PrivatePort}`).join(', ') || '-'
    }))
}