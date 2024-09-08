export class ModalsLogic {
    private static readonly modalPageBg: DOMTokenList = document.querySelector<HTMLDivElement>('#modal-page-bg')!.classList;
    private static openCount: number = 0;
    private modalRefCache: Map<string, HTMLDivElement>;

    constructor() {
        this.modalRefCache = new Map();
    }

    public init(): void {
        const showBtnList: NodeList = document.querySelectorAll<HTMLDivElement>('[data-mbmon-modal-targ]');
        const closeBtnList: NodeList = document.querySelectorAll<HTMLElement>('[data-mbmon-modal-dismiss]');

        for (const btn of showBtnList) {
            const modalId: string = (btn as HTMLDivElement).dataset.mbmonModalTarg as string;

            if (!this.modalRefCache.has(modalId))
                this.modalRefCache.set(modalId, document.querySelector<HTMLDivElement>(modalId)!);

            btn.addEventListener('click', this.showModal.bind(this));
        }

        for (const closeBtn of closeBtnList) {
            const modalId: string = (closeBtn as HTMLElement).dataset.mbmonModalDismiss as string;

            if (!this.modalRefCache.has(modalId))
                this.modalRefCache.set(modalId, document.querySelector<HTMLDivElement>(modalId)!);

            closeBtn.addEventListener('click', this.dismissModal.bind(this));
        }

        this.modalRefCache.forEach((modalElm: HTMLDivElement): void => {
            modalElm.addEventListener('click', this.dismissOutside.bind(this));
        });

        document.addEventListener('keyup', this.dismissEscKey.bind(this));
    }

    public static show(modal: HTMLDivElement): void {
        const modalBase: HTMLDivElement = modal.querySelector<HTMLDivElement>(':first-child')!;

        modal.classList.remove('hidden');
        modal.removeAttribute('aria-hidden');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('role', 'dialog');
        modalBase.focus(); // anim trick, better way?
        modalBase.classList.remove('opacity-0');
        modalBase.classList.add('opacity-100', 'transform-none');
        ModalsLogic.modalPageBg.remove('hidden');
        document.body.classList.add('overflow-hidden', 'pr-0');
        ++ModalsLogic.openCount;

        modal.dataset.mbmonModalOpen = "true";
    }

    public static hide(modal: HTMLDivElement): void {
        const modalBase: HTMLDivElement = modal.querySelector<HTMLDivElement>(':first-child')!;

        modal.removeAttribute('aria-modal');
        modal.removeAttribute('role');
        modal.setAttribute('aria-hidden', 'true');
        modalBase.focus(); // anim trick, better way?
        modalBase.classList.remove('opacity-100', 'transform-none');
        modalBase.classList.add('opacity-0');
        --ModalsLogic.openCount;
        delete modal.dataset.mbmonModalOpen;

        setTimeout((): void => modal.classList.add('hidden'), 300);

        if (ModalsLogic.openCount <= 0) {
            ModalsLogic.openCount = 0;

            ModalsLogic.modalPageBg.add('hidden');
            document.body.classList.remove('overflow-hidden', 'pr-0');
        }
    }

    private showModal(e: Event): void {
        const modal: HTMLDivElement = this.modalRefCache.get((e.currentTarget as HTMLDivElement).dataset.mbmonModalTarg as string)!;

        ModalsLogic.show(modal);
    }

    private dismissModal(e: Event): void {
        const modal: HTMLDivElement = this.modalRefCache.get((e.currentTarget as HTMLElement).dataset.mbmonModalDismiss as string)!;

        ModalsLogic.hide(modal);
    }

    private dismissOutside(e: Event): void {
        if (!(e.target as HTMLElement).hasAttribute('aria-modal'))
            return;

        const dismissBtn: HTMLElement = (e.currentTarget as HTMLDivElement).querySelector<HTMLElement>('[data-mbmon-modal-dismiss]')!;

        dismissBtn.dispatchEvent(new Event('click'));
    }

    private dismissEscKey(e: KeyboardEvent): void {
        if (e.code !== 'Escape')
            return;

        document.querySelectorAll<HTMLDivElement>('[data-mbmon-modal-open]').forEach((modal: HTMLDivElement): void => {
            ModalsLogic.hide(modal);
        });
    }
}