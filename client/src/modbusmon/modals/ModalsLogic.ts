export class ModalsLogic {
    private modalRefCache: Map<string, HTMLDivElement>;
    private readonly modalPageBg: DOMTokenList;
    private openCount: number;

    constructor() {
        this.modalPageBg = document.querySelector<HTMLDivElement>('#modal-page-bg')!.classList;
        this.modalRefCache = new Map();
        this.openCount = 0;
    }

    public init(): void {
        const showBtnList: NodeList = document.querySelectorAll<HTMLDivElement>('[data-mbmon-modal-targ]');
        const closeBtnList: NodeList = document.querySelectorAll<HTMLElement>('[data-mbmon-modal-dismiss]');

        for (const btn of showBtnList) {
            const modalId: string = (btn as HTMLDivElement).dataset.mbmonModalTarg as string;
            const modalElm: HTMLDivElement = document.querySelector<HTMLDivElement>(modalId)!;

            modalElm.addEventListener('click', this.dismissOutside.bind(this));
            modalElm.querySelectorAll<HTMLElement>('[data-mbmon-modal-dismiss]').forEach((dismissBtn: HTMLElement): void => {
                dismissBtn.setAttribute('data-mbmon-modal-dismiss', modalId);
            });

            this.modalRefCache.set(modalId, modalElm);
            btn.addEventListener('click', this.showModal.bind(this));
        }

        for (const closeBtn of closeBtnList)
            closeBtn.addEventListener('click', this.dismissModal.bind(this));
    }

    private showModal(e: Event): void {
        const modal: HTMLDivElement = this.modalRefCache.get((e.currentTarget as HTMLDivElement).dataset.mbmonModalTarg as string)!;
        const modalBase: HTMLDivElement = modal.querySelector<HTMLDivElement>(':first-child')!;

        modal.classList.remove('hidden');
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('role', 'dialog');
        modalBase.focus(); // anim trick, better way?
        modalBase.classList.remove('opacity-0');
        modalBase.classList.add('opacity-100', 'transform-none');
        this.modalPageBg.remove('hidden');
        document.body.classList.add('overflow-hidden', 'pr-0');
        ++this.openCount;
    }

    private dismissModal(e: Event): void {
        const modal: HTMLDivElement = this.modalRefCache.get((e.currentTarget as HTMLElement).dataset.mbmonModalDismiss as string)!;
        const modalBase: HTMLDivElement = modal.querySelector<HTMLDivElement>(':first-child')!;

        modal.removeAttribute('aria-modal');
        modal.removeAttribute('role');
        modal.setAttribute('aria-hidden', 'true');
        modalBase.focus(); // anim trick, better way?
        modalBase.classList.remove('opacity-100', 'transform-none');
        modalBase.classList.add('opacity-0');
        --this.openCount;

        setTimeout((): void => modal.classList.add('hidden'), 300);

        if (this.openCount <= 0) {
            this.openCount = 0;

            this.modalPageBg.add('hidden');
            document.body.classList.remove('overflow-hidden', 'pr-0');
        }
    }

    private dismissOutside(e: Event): void {
        if (!(e.target as HTMLElement).hasAttribute('aria-modal'))
            return;

        const dismissBtn: HTMLElement = (e.currentTarget as HTMLDivElement).querySelector<HTMLElement>('[data-mbmon-modal-dismiss]')!;

        dismissBtn.dispatchEvent(new Event('click'));
    }
}